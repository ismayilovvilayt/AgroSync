'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Cloud, Droplets, Wind, Thermometer, RefreshCw,
  MapPin, AlertCircle, Sun, Zap,
} from 'lucide-react';
import { format } from 'date-fns';
import { az } from 'date-fns/locale';

const DAY_NAMES = ['Bazar', 'Bazar ertəsi', 'Çərşənbə axşamı', 'Çərşənbə', 'Cümə axşamı', 'Cümə', 'Şənbə'];
const SHORT_DAY = ['Baz', 'B.ert', 'Çrş.ax', 'Çrş', 'Cüm.ax', 'Cüm', 'Şnb'];

function getDayName(dateStr: string, short = false) {
  const d = new Date(dateStr + 'T00:00:00');
  return short ? SHORT_DAY[d.getDay()] : DAY_NAMES[d.getDay()];
}

function isToday(dateStr: string) {
  return new Date().toISOString().split('T')[0] === dateStr;
}

export default function WeatherPage() {
  const [farms, setFarms] = useState<any[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState('');
  const [weather, setWeather] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noCoords, setNoCoords] = useState(false);

  // Manual koordinat daxiletmə
  const [manualMode, setManualMode] = useState(false);
  const [manualLat, setManualLat] = useState('');
  const [manualLon, setManualLon] = useState('');
  const [savingCoords, setSavingCoords] = useState(false);

  useEffect(() => {
    fetch('/api/farms').then(r => r.json()).then(d => {
      setFarms(Array.isArray(d) ? d : []);
      if (Array.isArray(d) && d.length > 0) setSelectedFarmId(d[0].id);
    });
  }, []);

  const fetchWeather = useCallback(async (farmId?: string, lat?: string, lon?: string) => {
    setLoading(true);
    setError(null);
    setNoCoords(false);
    setWeather(null);
    try {
      let url = '/api/weather?';
      if (lat && lon) {
        url += `lat=${lat}&lon=${lon}`;
      } else {
        url += `farmId=${farmId || selectedFarmId}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'NO_COORDINATES') {
          setNoCoords(true);
        } else {
          setError(data.message || data.error || 'Xəta baş verdi');
        }
      } else {
        setWeather(data);
      }
    } catch {
      setError('Şəbəkə xətası');
    } finally {
      setLoading(false);
    }
  }, [selectedFarmId]);

  useEffect(() => {
    if (selectedFarmId) fetchWeather(selectedFarmId);
  }, [selectedFarmId]);

  const handleSaveCoords = async () => {
    if (!manualLat || !manualLon || !selectedFarmId) return;
    setSavingCoords(true);
    try {
      await fetch(`/api/farms/${selectedFarmId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude: manualLat, longitude: manualLon }),
      });
      setManualMode(false);
      fetchWeather(selectedFarmId);
    } finally {
      setSavingCoords(false);
    }
  };

  const selectedFarm = farms.find(f => f.id === selectedFarmId);

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Cloud className="w-7 h-7 text-info" /> Hava Proqnozu
          </h1>
          <p className="text-sm text-base-content/50 mt-1">Open-Meteo · 7 günlük proqnoz</p>
        </div>
        <button
          className="btn btn-outline btn-sm gap-1"
          onClick={() => fetchWeather(selectedFarmId)}
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Yenilə
        </button>
      </div>

      {/* Farm Selector */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          className="select select-bordered select-sm w-52"
          value={selectedFarmId}
          onChange={e => setSelectedFarmId(e.target.value)}
        >
          <option value="">Təsərrüfat seçin</option>
          {farms.map((f: any) => (
            <option key={f.id} value={f.id}>
              {f.name} {f.latitude ? '📍' : '❓'}
            </option>
          ))}
        </select>
        {selectedFarm && (
          <div className="flex items-center gap-1 text-xs text-base-content/50">
            <MapPin className="w-3 h-3" />
            {selectedFarm.latitude
              ? `${selectedFarm.latitude}°N, ${selectedFarm.longitude}°E`
              : 'Koordinat yoxdur'}
          </div>
        )}
        <button
          className="btn btn-ghost btn-xs gap-1"
          onClick={() => setManualMode(!manualMode)}
        >
          <MapPin className="w-3 h-3" />
          {manualMode ? 'Ləğv et' : 'Koordinat daxil et'}
        </button>
      </div>

      {/* Manual Coord Input */}
      {manualMode && (
        <div className="card bg-base-200 border border-base-300">
          <div className="card-body p-4">
            <h3 className="font-medium text-sm mb-3 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" />
              GPS Koordinatları daxil edin
            </h3>
            <p className="text-xs text-base-content/50 mb-3">
              Google Maps-da istənilən nöqtəyə sağ klik → koordinatları kopyalayın
            </p>
            <div className="flex flex-wrap gap-2 items-end">
              <div>
                <label className="label label-text text-xs">Enlik (Latitude)</label>
                <input
                  type="number"
                  step="0.000001"
                  placeholder="40.409264"
                  className="input input-bordered input-sm w-36"
                  value={manualLat}
                  onChange={e => setManualLat(e.target.value)}
                />
              </div>
              <div>
                <label className="label label-text text-xs">Uzunluq (Longitude)</label>
                <input
                  type="number"
                  step="0.000001"
                  placeholder="49.867092"
                  className="input input-bordered input-sm w-36"
                  value={manualLon}
                  onChange={e => setManualLon(e.target.value)}
                />
              </div>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleSaveCoords}
                disabled={!manualLat || !manualLon || savingCoords}
              >
                {savingCoords ? <span className="loading loading-spinner loading-xs" /> : 'Saxla və yüklə'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* No Coords State */}
      {noCoords && !manualMode && (
        <div className="alert alert-warning">
          <AlertCircle className="w-5 h-5" />
          <div>
            <p className="font-medium">GPS koordinatı qeyd edilməyib</p>
            <p className="text-sm">Bu təsərrüfat üçün hava proqnozu göstərmək üçün koordinat lazımdır. Yuxarıdakı "Koordinat daxil et" düyməsini istifadə edin.</p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="alert alert-error">
          <AlertCircle className="w-5 h-5" />
          <p>{error}</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-16">
          <div className="loading loading-spinner loading-lg" />
        </div>
      )}

      {/* Weather Data */}
      {weather && !loading && (
        <>
          {/* 7-day horizontal scroll strip */}
          <div style={{ overflowX: 'auto', marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 8, minWidth: 'max-content', paddingBottom: 4 }}>
              {weather.days.map((d: any, i: number) => {
                const today = isToday(d.date);
                return (
                  <div
                    key={d.date}
                    className={today ? '' : 'bg-base-100 border border-base-300 hover:border-base-400'}
                    style={{
                      minWidth: 100, padding: '12px 8px',
                      borderRadius: 14, textAlign: 'center',
                      background: today
                        ? 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)'
                        : undefined,
                      color: today ? 'white' : undefined,
                      boxShadow: today ? '0 4px 20px rgba(59,130,246,0.4)' : undefined,
                      transform: today ? 'scale(1.04)' : undefined,
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{ fontSize: 10, fontWeight: 600, opacity: 0.7, marginBottom: 4 }}>
                      {getDayName(d.date, true)}
                    </div>
                    <div style={{ fontSize: 24, marginBottom: 4 }}>{d.weatherEmoji}</div>
                    <div style={{ fontWeight: 800, fontSize: 15 }}>{d.maxTemp}°</div>
                    <div style={{ fontSize: 11, opacity: 0.6 }}>{d.minTemp}°</div>
                    {d.precipitation > 0 && (
                      <div style={{
                        marginTop: 4, fontSize: 10, fontWeight: 700,
                        color: today ? 'rgba(186,230,253,1)' : '#0EA5E9',
                      }}>
                        💧 {d.precipitation}mm
                      </div>
                    )}
                    {d.irrigationNeeded && !d.precipitation && (
                      <div style={{ marginTop: 4, fontSize: 10, color: today ? '#FDE68A' : '#F59E0B', fontWeight: 700 }}>
                        ⚠ Suvarma
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Today detail */}
          {weather.days[0] && (
            <div style={{
              background: 'var(--fallback-b1,oklch(var(--b1)/1))',
              border: '1px solid var(--fallback-b3,oklch(var(--b3)/1))',
              borderRadius: 16, padding: 20, marginBottom: 4,
              boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
            }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, justifyContent: 'space-between' }}>
                {/* Left: big temp */}
                <div>
                  <div style={{ fontSize: 12, opacity: 0.5, marginBottom: 6 }}>
                    {format(new Date(weather.days[0].date + 'T00:00:00'), 'dd MMMM yyyy, cccc', { locale: az })} — Bugün
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 56, lineHeight: 1 }}>{weather.days[0].weatherEmoji}</span>
                    <div>
                      <div style={{ fontSize: 36, fontWeight: 800, lineHeight: 1 }}>
                        {weather.days[0].maxTemp}°C
                      </div>
                      <div style={{ fontSize: 13, opacity: 0.6, marginTop: 2 }}>
                        {weather.days[0].weatherLabel}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: metrics grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 20px', alignContent: 'center' }}>
                  {[
                    { icon: '🌡', label: 'Min temp', value: `${weather.days[0].minTemp}°C`, color: '#3B82F6' },
                    { icon: '💧', label: 'Yağış', value: `${weather.days[0].precipitation} mm`, color: '#0EA5E9' },
                    { icon: '💨', label: 'Külək', value: `${weather.days[0].windMax} km/h`, color: '#6B7280' },
                    { icon: '☀️', label: 'UV indeksi', value: weather.days[0].uvIndex, color: '#F59E0B' },
                    { icon: '🌿', label: 'ET₀', value: `${weather.days[0].et0} mm/gün`, color: '#10B981', span: true },
                  ].map((m: any) => (
                    <div key={m.label} style={m.span ? { gridColumn: 'span 2' } : {}}>
                      <div style={{ fontSize: 10, opacity: 0.5, marginBottom: 2 }}>{m.icon} {m.label}</div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: m.color }}>{m.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Irrigation advice */}
              <div style={{
                marginTop: 14,
                padding: '10px 14px',
                borderRadius: 10,
                background: weather.days[0].irrigationNeeded
                  ? 'rgba(245,158,11,0.1)'
                  : 'rgba(16,185,129,0.1)',
                border: `1px solid ${weather.days[0].irrigationNeeded ? 'rgba(245,158,11,0.3)' : 'rgba(16,185,129,0.3)'}`,
                display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13,
              }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>
                  {weather.days[0].irrigationNeeded ? '⚠️' : '✅'}
                </span>
                <span>
                  {weather.days[0].irrigationNeeded
                    ? <><strong>Suvarma məsləhət görülür:</strong> Yağış ({weather.days[0].precipitation}mm) ET₀-dan ({weather.days[0].et0}mm) azdır.
                    </>
                    : <>Yağış ({weather.days[0].precipitation}mm) ET₀-dan ({weather.days[0].et0}mm) çoxdur — bu gün suvarma tələb olunmur.</>}
                </span>
              </div>
            </div>
          )}

          {/* 7-day summary stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: Droplets, label: '7 günlük yağış', value: `${weather.totalRain7Days} mm`, color: 'text-info' },
              { icon: Thermometer, label: 'Orta temperatur', value: `${weather.avgTemp7Days}°C`, color: 'text-warning' },
              { icon: Zap, label: '7 günlük ET₀', value: `${weather.totalEt07Days} mm`, color: 'text-success' },
            ].map(stat => (
              <div key={stat.label} className="card bg-base-100 border border-base-300 shadow-sm">
                <div className="card-body p-3 flex-row items-center gap-3">
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                  <div>
                    <p className={`text-lg font-bold ${stat.color}`}>{stat.value}</p>
                    <p className="text-xs text-base-content/50">{stat.label}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 7-day table */}
          <div className="card bg-base-100 border border-base-300 shadow-sm">
            <div className="card-body p-0">
              <div className="overflow-x-auto">
                <table className="table table-sm">
                  <thead>
                    <tr className="text-xs bg-base-200/50">
                      <th>Gün</th>
                      <th>Hava</th>
                      <th>Maks°</th>
                      <th>Min°</th>
                      <th>Yağış</th>
                      <th>ET₀</th>
                      <th>Külək</th>
                      <th>UV</th>
                      <th>Suvarma</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weather.days.map((d: any) => (
                      <tr key={d.date} className={isToday(d.date) ? 'bg-primary/5 font-medium' : ''}>
                        <td className="text-xs">
                          <div>{getDayName(d.date)}</div>
                          <div className="text-base-content/40">{d.date.slice(5)}</div>
                        </td>
                        <td>{d.weatherEmoji} <span className="text-xs">{d.weatherLabel}</span></td>
                        <td className="text-error font-medium">{d.maxTemp}°</td>
                        <td className="text-info">{d.minTemp}°</td>
                        <td>
                          {d.precipitation > 0
                            ? <span className="badge badge-info badge-sm">{d.precipitation}mm</span>
                            : <span className="text-base-content/30 text-xs">—</span>}
                        </td>
                        <td className="text-success font-medium">{d.et0}mm</td>
                        <td className="text-xs">{d.windMax} km/h</td>
                        <td className="text-xs">{d.uvIndex}</td>
                        <td>
                          {d.irrigationNeeded
                            ? <span className="badge badge-warning badge-sm">Lazım</span>
                            : <span className="badge badge-success badge-sm">Lazım deyil</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
