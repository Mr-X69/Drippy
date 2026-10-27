"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  SlidersHorizontal,
  Sparkles,
  Database,
  Info,
  Check,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  Trash2,
  CloudSun,
  MapPin,
  Search,
  Navigation,
} from "lucide-react";
import {
  db,
  loadSampleWardrobe,
  auditWardrobeRecords,
  pruneDuplicateSamples,
  sanitizeMislabeledSampleImages,
  purgeAllLegacySamples,
  type WardrobeAuditReport,
} from "@/lib/db";
import {
  geocodeCity,
  getConfiguredLocation,
  setConfiguredLocation,
  clearConfiguredLocation,
  fetchCurrentWeather,
  type GeocodedCity,
  type ConfiguredLocation,
  type WeatherData,
} from "@/lib/weather";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const [isResetting, setIsResetting] = useState(false);
  const [auditReport, setAuditReport] = useState<WardrobeAuditReport | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Weather & Location State (lazily initialized from storage)
  const [configuredLoc, setConfiguredLoc] = useState<ConfiguredLocation | null>(() =>
    getConfiguredLocation()
  );
  const [cityQuery, setCityQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GeocodedCity[]>([]);
  const [isSearchingCity, setIsSearchingCity] = useState(false);
  const [weatherPreview, setWeatherPreview] = useState<WeatherData | null>(null);
  const [isLoadingWeather, setIsLoadingWeather] = useState(() =>
    Boolean(configuredLoc && configuredLoc.type === "manual")
  );

  const refreshAudit = async () => {
    try {
      const report = await auditWardrobeRecords();
      setAuditReport(report);
    } catch (err) {
      console.error("Failed to run wardrobe audit:", err);
    }
  };

  useEffect(() => {
    let isMounted = true;
    auditWardrobeRecords().then((report) => {
      if (isMounted) {
        setAuditReport(report);
      }
    });

    if (configuredLoc && configuredLoc.type === "manual" && typeof configuredLoc.latitude === "number") {
      fetchCurrentWeather(configuredLoc.latitude, configuredLoc.longitude)
        .then((w) => {
          if (isMounted) {
            setWeatherPreview(w);
            setIsLoadingWeather(false);
          }
        })
        .catch(() => {
          if (isMounted) {
            setIsLoadingWeather(false);
          }
        });
    }

    return () => {
      isMounted = false;
    };
  }, [configuredLoc]);

  const handleSearchCity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cityQuery.trim()) return;
    setIsSearchingCity(true);
    try {
      const results = await geocodeCity(cityQuery);
      setSearchResults(results);
      if (results.length === 0) {
        setToastMessage(`No city found matching "${cityQuery}".`);
        setTimeout(() => setToastMessage(null), 3000);
      }
    } catch (err) {
      console.error("City search error:", err);
    } finally {
      setIsSearchingCity(false);
    }
  };

  const handleSelectCity = async (city: GeocodedCity) => {
    const loc: ConfiguredLocation = {
      type: "manual",
      name: `${city.name}${city.admin1 ? `, ${city.admin1}` : ""}${city.country ? `, ${city.country}` : ""}`,
      latitude: city.latitude,
      longitude: city.longitude,
      country: city.country,
      admin1: city.admin1,
    };
    setConfiguredLocation(loc);
    setConfiguredLoc(loc);
    setSearchResults([]);
    setCityQuery("");
    setIsLoadingWeather(true);
    try {
      const weather = await fetchCurrentWeather(city.latitude, city.longitude);
      setWeatherPreview(weather);
      setToastMessage(`Weather location set to ${city.name}.`);
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err) {
      console.error("Failed to fetch weather for selected city:", err);
    } finally {
      setIsLoadingWeather(false);
    }
  };

  const handleResetToGeolocation = () => {
    clearConfiguredLocation();
    setConfiguredLoc(null);
    setWeatherPreview(null);
    setToastMessage("Reset to browser dynamic geolocation.");
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handlePruneDuplicates = async () => {
    if (!auditReport || auditReport.duplicateSamples.length === 0) return;
    const confirmed = confirm(
      `Remove ${auditReport.duplicateSamples.length} confirmed duplicate sample records? All unique samples and your genuine user items will be preserved.`
    );
    if (!confirmed) return;

    setIsResetting(true);
    try {
      const res = await pruneDuplicateSamples();
      await refreshAudit();
      setToastMessage(`Pruned ${res.removedCount} duplicate samples. ${res.remainingCount} items remaining.`);
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err) {
      console.error("Failed to prune duplicates:", err);
    } finally {
      setIsResetting(false);
    }
  };

  const handleSanitizeImages = async () => {
    if (!auditReport || auditReport.mislabeledImageSamples.length === 0) return;
    const confirmed = confirm(
      `Replace ${auditReport.mislabeledImageSamples.length} sample items displaying portraits or gym weights with neutral placeholders?`
    );
    if (!confirmed) return;

    setIsResetting(true);
    try {
      const updated = await sanitizeMislabeledSampleImages();
      await refreshAudit();
      setToastMessage(`Sanitized ${updated} sample images to neutral placeholders.`);
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err) {
      console.error("Failed to sanitize images:", err);
    } finally {
      setIsResetting(false);
    }
  };

  const handlePurgeAllSamples = async () => {
    if (!auditReport) return;
    const totalSamples = auditReport.legacySamples.length + auditReport.duplicateSamples.length;
    if (totalSamples === 0) return;

    const confirmed = confirm(
      `Purge all ${totalSamples} legacy sample items from your database? This will strictly retain your ${auditReport.genuine.length} genuine user-created pieces.`
    );
    if (!confirmed) return;

    setIsResetting(true);
    try {
      const res = await purgeAllLegacySamples();
      await refreshAudit();
      setToastMessage(`Purged ${res.removedCount} sample items. ${res.genuinePreservedCount} genuine items preserved.`);
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err) {
      console.error("Failed to purge legacy samples:", err);
    } finally {
      setIsResetting(false);
    }
  };

  const handleLoadSamples = async () => {
    setIsResetting(true);
    try {
      await loadSampleWardrobe();
      await refreshAudit();
      setToastMessage("Sample curated pieces added to wardrobe.");
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err) {
      console.error("Failed to load sample wardrobe:", err);
    } finally {
      setIsResetting(false);
    }
  };

  const handleResetData = async () => {
    if (!confirm("Are you sure you want to clear your wardrobe and reset to sample pieces? This cannot be undone.")) {
      return;
    }
    setIsResetting(true);
    try {
      await db.wardrobe_items.clear();
      await db.outfits.clear();
      await db.planned_slots.clear();
      await loadSampleWardrobe();
      await refreshAudit();
      setToastMessage("Wardrobe reset to curated editorial defaults.");
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err) {
      console.error("Failed to reset database:", err);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen text-[#1A1A1A] pb-28">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#F9F8F6]/95 backdrop-blur-md px-5 pt-4 pb-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="p-1.5 -ml-1.5 rounded-full text-[#1A1A1A] hover:bg-[#F0EDE6] transition-colors"
              aria-label="Back to wardrobe"
            >
              <ChevronLeft size={20} strokeWidth={2.2} />
            </Link>
            <div>
              <span className="text-[9px] font-semibold tracking-[0.24em] text-[#8C887B] uppercase block">
                Preferences
              </span>
              <h1 className="text-xl font-bold tracking-tight text-[#1A1A1A] mt-0.5">
                Settings & Archive
              </h1>
            </div>
          </div>

          <div className="w-8 h-8 rounded-full bg-[#EBF2EC] flex items-center justify-center text-[#2D3A2F]">
            <SlidersHorizontal size={15} />
          </div>
        </div>
      </header>

      {/* Main Settings Body */}
      <main className="px-5 pt-4 flex flex-col gap-5">
        {/* Section 1: AI & Vision Pipeline */}
        <section className="bg-[#FFFFFF] rounded-3xl p-4 shadow-[0_4px_24px_rgba(0,0,0,0.03)] flex flex-col gap-3">
          <div className="flex items-center gap-2.5 pb-2 border-b border-[#EAE7E1]/60">
            <div className="w-7 h-7 rounded-full bg-[#EBF2EC] flex items-center justify-center text-[#2D3A2F]">
              <Sparkles size={14} />
            </div>
            <div>
              <h2 className="text-xs font-bold tracking-tight text-[#1A1A1A]">
                AI & Neural Pipelines
              </h2>
              <span className="text-[10px] text-[#8C887B]">
                Garment tagging & virtual drapery
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2.5 text-xs">
            <div className="flex items-center justify-between py-1">
              <div>
                <p className="font-semibold text-[#1A1A1A]">Gemini Vision Flash</p>
                <p className="text-[10px] text-[#8C887B]">Auto-intake & color palette mapping</p>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-[#EBF2EC] text-[#2D3A2F] text-[10px] font-bold">
                gemini-3.8-flash
              </span>
            </div>

            <div className="flex items-center justify-between py-1 border-t border-[#EAE7E1]/50">
              <div>
                <p className="font-semibold text-[#1A1A1A]">Hugging Face VTON</p>
                <p className="text-[10px] text-[#8C887B]">Gradio Client • Neural Virtual Try-On</p>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-[#F0EDE6] text-[#1A1A1A] text-[10px] font-medium">
                IDM-VTON Lane
              </span>
            </div>
          </div>
        </section>

        {/* Section: Weather & Location Preferences */}
        <section className="bg-[#FFFFFF] rounded-3xl p-4 shadow-[0_4px_24px_rgba(0,0,0,0.03)] flex flex-col gap-3">
          <div className="flex items-center gap-2.5 pb-2 border-b border-[#EAE7E1]/60">
            <div className="w-7 h-7 rounded-full bg-[#EBF2EC] flex items-center justify-center text-[#2D3A2F]">
              <CloudSun size={14} />
            </div>
            <div>
              <h2 className="text-xs font-bold tracking-tight text-[#1A1A1A]">
                Weather & Location Preferences
              </h2>
              <span className="text-[10px] text-[#8C887B]">
                Open-Meteo live metrics for seasonal outfit curation
              </span>
            </div>
          </div>

          {/* Current Active Location Display */}
          <div className="bg-[#F9F8F6] border border-[#EAE7E1] rounded-2xl p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8C887B] flex items-center gap-1">
                <MapPin size={11} className="text-[#2D3A2F]" />
                Active Styling Location
              </span>
              {configuredLoc?.type === "manual" ? (
                <span className="text-[9px] font-bold text-[#2D3A2F] bg-[#EBF2EC] px-2 py-0.5 rounded-full">
                  Manual City
                </span>
              ) : (
                <span className="text-[9px] font-medium text-[#8C887B] bg-[#EFECE6] px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Navigation size={9} /> Dynamic Geolocation
                </span>
              )}
            </div>

            <div className="flex items-baseline justify-between">
              <h3 className="text-sm font-bold text-[#1A1A1A] truncate">
                {configuredLoc?.type === "manual" ? configuredLoc.name : "Browser Geolocation"}
              </h3>
              {configuredLoc?.type === "manual" && (
                <button
                  type="button"
                  onClick={handleResetToGeolocation}
                  className="text-[10px] font-medium text-[#9A4C3D] hover:underline"
                >
                  Use Browser GPS
                </button>
              )}
            </div>

            {/* Live Weather Preview if available */}
            {isLoadingWeather ? (
              <span className="text-[11px] text-[#8C887B] animate-pulse">
                Fetching weather metrics...
              </span>
            ) : weatherPreview ? (
              <div className="text-[11px] text-[#2D3A2F] font-medium bg-[#EBF2EC]/70 rounded-xl p-2 flex items-center justify-between">
                <span>{weatherPreview.summary}</span>
                <span className="text-[10px] text-[#8C887B]">
                  Wind: {weatherPreview.windSpeed} km/h • Humidity: {weatherPreview.humidity}%
                </span>
              </div>
            ) : (
              <p className="text-[10px] text-[#8C887B]">
                {configuredLoc?.type === "manual"
                  ? "Weather metrics fetched on demand."
                  : "Requires browser location permission. If denied, style engine curates with balanced seasonal defaults."}
              </p>
            )}
          </div>

          {/* Search Manual City Form */}
          <form onSubmit={handleSearchCity} className="flex flex-col gap-2 pt-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-[#8C887B]">
              Configure Manual City
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={cityQuery}
                  onChange={(e) => setCityQuery(e.target.value)}
                  placeholder="e.g. Kolhapur, Pune, Mumbai, London"
                  className="w-full bg-[#F9F8F6] border border-[#EAE7E1] rounded-xl pl-3 pr-8 py-2 text-xs text-[#1A1A1A] placeholder-[#8C887B] focus:outline-none focus:ring-1 focus:ring-[#2D3A2F]"
                />
                <Search size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8C887B]" />
              </div>

              <button
                type="submit"
                disabled={isSearchingCity || !cityQuery.trim()}
                className={cn(
                  "py-2 px-3.5 rounded-xl text-xs font-semibold tracking-wide transition-all shadow-xs",
                  !cityQuery.trim() || isSearchingCity
                    ? "bg-[#EFECE6] text-[#8C887B] cursor-not-allowed"
                    : "bg-[#2D3A2F] text-[#F9F8F6] hover:bg-[#232E25]"
                )}
              >
                {isSearchingCity ? "Searching..." : "Search"}
              </button>
            </div>

            {/* Quick Suggestion Chips */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[9px] text-[#8C887B]">Quick:</span>
              {[
                { name: "Kolhapur", latitude: 16.6956, longitude: 74.2317, admin1: "Maharashtra", country: "India" },
                { name: "Pune", latitude: 18.5204, longitude: 73.8567, admin1: "Maharashtra", country: "India" },
                { name: "Mumbai", latitude: 19.0760, longitude: 72.8777, admin1: "Maharashtra", country: "India" },
                { name: "Bengaluru", latitude: 12.9716, longitude: 77.5946, admin1: "Karnataka", country: "India" },
              ].map((c) => (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => handleSelectCity(c)}
                  className="px-2 py-0.5 rounded-lg bg-[#EFECE6] text-[#1A1A1A] text-[10px] font-medium hover:bg-[#E2DFD6] transition-colors"
                >
                  {c.name}
                </button>
              ))}
            </div>

            {/* Search Results Dropdown List */}
            {searchResults.length > 0 && (
              <div className="flex flex-col gap-1 mt-1 bg-[#F9F8F6] border border-[#EAE7E1] rounded-2xl p-2 shadow-sm animate-in fade-in">
                <span className="text-[9px] font-semibold uppercase tracking-wider text-[#8C887B] px-1">
                  Select Matching Location
                </span>
                {searchResults.map((city, idx) => (
                  <button
                    key={`${city.name}-${idx}`}
                    type="button"
                    onClick={() => handleSelectCity(city)}
                    className="flex items-center justify-between p-2 rounded-xl text-left text-xs hover:bg-[#EFECE6] transition-colors"
                  >
                    <span className="font-semibold text-[#1A1A1A]">
                      {city.name}
                      {city.admin1 ? `, ${city.admin1}` : ""}
                      {city.country ? `, ${city.country}` : ""}
                    </span>
                    <span className="text-[9px] text-[#8C887B]">
                      {city.latitude.toFixed(2)}°, {city.longitude.toFixed(2)}°
                    </span>
                  </button>
                ))}
              </div>
            )}
          </form>
        </section>

        {/* Section 2: Storage & Database */}
        <section className="bg-[#FFFFFF] rounded-3xl p-4 shadow-[0_4px_24px_rgba(0,0,0,0.03)] flex flex-col gap-3">
          <div className="flex items-center gap-2.5 pb-2 border-b border-[#EAE7E1]/60">
            <div className="w-7 h-7 rounded-full bg-[#F0EDE6] flex items-center justify-center text-[#1A1A1A]">
              <Database size={14} />
            </div>
            <div>
              <h2 className="text-xs font-bold tracking-tight text-[#1A1A1A]">
                Offline Storage
              </h2>
              <span className="text-[10px] text-[#8C887B]">
                Dexie.js IndexedDB local persistence
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2.5 text-xs">
            <div className="flex items-center justify-between py-1">
              <div>
                <p className="font-semibold text-[#1A1A1A]">Local Database</p>
                <p className="text-[10px] text-[#8C887B]">
                  Encrypted browser storage • 100% private
                </p>
              </div>
              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                Active & Synced
              </span>
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <button
                onClick={handleLoadSamples}
                disabled={isResetting}
                className="w-full py-2.5 px-3 rounded-2xl bg-[#2D3A2F] hover:bg-[#232E25] text-xs font-semibold text-[#F9F8F6] flex items-center justify-center gap-2 transition-all active:scale-98 shadow-xs"
              >
                <Sparkles size={13} className={cn(isResetting && "animate-spin")} />
                <span>Load Sample Curated Pieces</span>
              </button>

              <button
                onClick={handleResetData}
                disabled={isResetting}
                className="w-full py-2.5 px-3 rounded-2xl bg-[#F0EDE6] hover:bg-[#EAE6DC] text-xs font-semibold text-[#8C3A3A] flex items-center justify-center gap-2 transition-all active:scale-98"
              >
                <RefreshCw size={13} className={cn(isResetting && "animate-spin")} />
                <span>Reset Database to Curated Samples</span>
              </button>
            </div>
          </div>
        </section>

        {/* Section 2.5: Wardrobe Data Audit & Preservation */}
        <section className="bg-[#FFFFFF] rounded-3xl p-4 shadow-[0_4px_24px_rgba(0,0,0,0.03)] flex flex-col gap-3">
          <div className="flex items-center gap-2.5 pb-2 border-b border-[#EAE7E1]/60">
            <div className="w-7 h-7 rounded-full bg-[#EBF2EC] flex items-center justify-center text-[#2D3A2F]">
              <ShieldCheck size={14} />
            </div>
            <div>
              <h2 className="text-xs font-bold tracking-tight text-[#1A1A1A]">
                Wardrobe Data Audit & Integrity
              </h2>
              <span className="text-[10px] text-[#8C887B]">
                Inspect & prune legacy demo data while strictly protecting genuine garments
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-2xl bg-[#F9F8F6] border border-[#EAE7E1]/70">
              <span className="text-[9px] font-bold uppercase tracking-wider text-[#8C887B] block">
                Total Wardrobe
              </span>
              <span className="text-base font-bold text-[#1A1A1A] mt-0.5 block">
                {auditReport ? `${auditReport.total} pieces` : "..."}
              </span>
            </div>

            <div className="p-2.5 rounded-2xl bg-[#EBF2EC]/50 border border-[#2D3A2F]/20">
              <span className="text-[9px] font-bold uppercase tracking-wider text-[#2D3A2F] block">
                Genuine User
              </span>
              <span className="text-base font-bold text-[#2D3A2F] mt-0.5 block">
                {auditReport ? `${auditReport.genuine.length} item` : "..."}
              </span>
            </div>

            <div className="p-2.5 rounded-2xl bg-[#F9F8F6] border border-[#EAE7E1]/70">
              <span className="text-[9px] font-bold uppercase tracking-wider text-[#8C887B] block">
                Duplicate Seeds
              </span>
              <span className="text-base font-bold text-amber-700 mt-0.5 block">
                {auditReport ? `${auditReport.duplicateSamples.length} duplicates` : "..."}
              </span>
            </div>

            <div className="p-2.5 rounded-2xl bg-[#F9F8F6] border border-[#EAE7E1]/70">
              <span className="text-[9px] font-bold uppercase tracking-wider text-[#8C887B] block">
                Mislabeled Photos
              </span>
              <span className="text-base font-bold text-rose-700 mt-0.5 block">
                {auditReport ? `${auditReport.mislabeledImageSamples.length} items` : "..."}
              </span>
            </div>
          </div>

          {auditReport && auditReport.genuine.length > 0 && (
            <div className="p-2.5 rounded-2xl bg-[#F9F8F6] border border-[#EAE7E1]/60 text-xs flex flex-col gap-1">
              <span className="text-[9px] font-bold uppercase tracking-wider text-[#2D3A2F]">
                Protected Genuine User Pieces ({auditReport.genuine.length}):
              </span>
              {auditReport.genuine.map((g) => (
                <div key={g.id} className="flex items-center justify-between text-[11px] text-[#1A1A1A]">
                  <span className="font-semibold">{g.name}</span>
                  <span className="text-[10px] text-[#8C887B]">{g.brand || "Unassigned"} • {g.category}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-2 pt-1 text-xs">
            {auditReport && auditReport.duplicateSamples.length > 0 && (
              <button
                onClick={handlePruneDuplicates}
                disabled={isResetting}
                className="w-full py-2.5 px-3 rounded-2xl bg-[#F0EDE6] hover:bg-[#EAE6DC] text-xs font-semibold text-[#1A1A1A] flex items-center justify-center gap-2 transition-all active:scale-98"
              >
                <Trash2 size={13} className="text-amber-700" />
                <span>Prune {auditReport.duplicateSamples.length} Duplicate Seeds</span>
              </button>
            )}

            {auditReport && auditReport.mislabeledImageSamples.length > 0 && (
              <button
                onClick={handleSanitizeImages}
                disabled={isResetting}
                className="w-full py-2.5 px-3 rounded-2xl bg-[#F0EDE6] hover:bg-[#EAE6DC] text-xs font-semibold text-[#1A1A1A] flex items-center justify-center gap-2 transition-all active:scale-98"
              >
                <AlertTriangle size={13} className="text-rose-700" />
                <span>Sanitize {auditReport.mislabeledImageSamples.length} Portrait/Dumbbell Photos</span>
              </button>
            )}

            {auditReport && (auditReport.legacySamples.length > 0 || auditReport.duplicateSamples.length > 0) && (
              <button
                onClick={handlePurgeAllSamples}
                disabled={isResetting}
                className="w-full py-2.5 px-3 rounded-2xl bg-[#F0EDE6] hover:bg-[#EAE6DC] text-xs font-semibold text-[#8C3A3A] flex items-center justify-center gap-2 transition-all active:scale-98"
              >
                <Trash2 size={13} className="text-[#8C3A3A]" />
                <span>Purge All Legacy Samples (Keep Only Genuine Items)</span>
              </button>
            )}
          </div>
        </section>

        {/* Section 3: Design & Philosophy */}
        <section className="bg-[#FFFFFF] rounded-3xl p-4 shadow-[0_4px_24px_rgba(0,0,0,0.03)] flex flex-col gap-3">
          <div className="flex items-center gap-2.5 pb-2 border-b border-[#EAE7E1]/60">
            <div className="w-7 h-7 rounded-full bg-[#F0EDE6] flex items-center justify-center text-[#1A1A1A]">
              <Info size={14} />
            </div>
            <div>
              <h2 className="text-xs font-bold tracking-tight text-[#1A1A1A]">
                Design Philosophy
              </h2>
              <span className="text-[10px] text-[#8C887B]">
                Quiet luxury & warm minimalism
              </span>
            </div>
          </div>

          <div className="text-[11px] text-[#8C887B] leading-relaxed">
            <p>
              Drippy embraces the principle of <span className="font-semibold text-[#1A1A1A]">Buy less, wear more</span>.
              By curating high-versatility staple garments in disciplined proportions (3:4 ratio),
              calm natural tones (#F9F8F6, #2D3A2F), and dual-track planning, every piece unlocks maximum utility.
            </p>
          </div>

          <div className="pt-2 border-t border-[#EAE7E1]/50 flex items-center justify-between text-[10px] text-[#8C887B]">
            <span>Version 1.0.0 Editorial</span>
            <span>Local Offline-First</span>
          </div>
        </section>
      </main>

      {/* Confirmation Toast */}
      {toastMessage && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-[#1A1A1A] text-[#F9F8F6] px-4 py-2 rounded-full text-xs font-medium tracking-wide flex items-center gap-2 shadow-xl animate-in fade-in slide-in-from-bottom-3 duration-200">
          <Check size={14} className="text-emerald-400" strokeWidth={3} />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
