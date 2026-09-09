import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

const WMO_CODES: Record<number, { label: string; emoji: string }> = {
  0: { label: 'Açıq', emoji: '☀️' },
  1: { label: 'Əsasən açıq', emoji: '🌤️' },
  2: { label: 'Qismən buludlu', emoji: '⛅' },
  3: { label: 'Buludlu', emoji: '☁️' },
  45: { label: 'Duman', emoji: '🌫️' },
  48: { label: 'Don dumanı', emoji: '🌫️' },
  51: { label: 'Çiskin', emoji: '🌦️' },
  53: { label: 'Orta çiskin', emoji: '🌦️' },
  55: { label: 'Güclü çiskin', emoji: '🌧️' },
  61: { label: 'Yüngül yağış', emoji: '🌧️' },
  63: { label: 'Orta yağış', emoji: '🌧️' },
  65: { label: 'Güclü yağış', emoji: '🌧️' },
  71: { label: 'Yüngül qar', emoji: '🌨️' },
  73: { label: 'Orta qar', emoji: '❄️' },
  75: { label: 'Güclü qar', emoji: '❄️' },
  80: { label: 'Leysanlı yağış', emoji: '⛈️' },
  81: { label: 'Orta leysan', emoji: '⛈️' },
  82: { label: 'Güclü leysan', emoji: '⛈️' },
  95: { label: 'Tufan', emoji: '⛈️' },
  96: { label: 'Dolu ilə tufan', emoji: '🌩️' },
  99: { label: 'Güclü dolu', emoji: '🌩️' },
};

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const farmId = searchParams.get('farmId');
    // Manual koordinat dəstəyi (istifadəçi özü daxil edərsə)
    const manualLat = searchParams.get('lat');
    const manualLon = searchParams.get('lon');

    let latitude: number | null = null;
    let longitude: number | null = null;
    let farmName = '';

    if (manualLat && manualLon) {
      latitude = parseFloat(manualLat);
      longitude = parseFloat(manualLon);
      farmName = 'Manual koordinat';
    } else if (farmId) {
      const farm = await prisma.farm.findUnique({
        where: { id: farmId },
        select: { name: true, latitude: true, longitude: true, location: true },
      });
      if (!farm) return NextResponse.json({ error: 'Təsərrüfat tapılmadı' }, { status: 404 });
      latitude = farm.latitude;
      longitude = farm.longitude;
      farmName = farm.name;
    }

    if (!latitude || !longitude) {
      return NextResponse.json({
        error: 'NO_COORDINATES',
        message: 'Bu təsərrüfat üçün GPS koordinatı qeyd edilməyib',
      }, { status: 422 });
    }

    // Open-Meteo API — pulsuz, API key yoxdur
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', latitude.toString());
    url.searchParams.set('longitude', longitude.toString());
    url.searchParams.set('daily', [
      'temperature_2m_max',
      'temperature_2m_min',
      'precipitation_sum',
      'windspeed_10m_max',
      'weathercode',
      'uv_index_max',
      'et0_fao_evapotranspiration', // Evapotranspirasiya — suvarma qərarı üçün çox vacib!
    ].join(','));
    url.searchParams.set('hourly', 'relativehumidity_2m,temperature_2m');
    url.searchParams.set('timezone', 'Asia/Baku');
    url.searchParams.set('forecast_days', '7');

    const meteoRes = await fetch(url.toString(), {
      next: { revalidate: 3600 }, // 1 saatlıq cache
    });

    if (!meteoRes.ok) {
      return NextResponse.json({ error: 'Hava xidməti cavab vermədi' }, { status: 502 });
    }

    const meteo = await meteoRes.json();
    const daily = meteo.daily;

    const days = daily.time.map((date: string, i: number) => {
      const code = daily.weathercode[i];
      const wmo = WMO_CODES[code] || { label: 'Naməlum', emoji: '❓' };
      return {
        date,
        maxTemp: Math.round(daily.temperature_2m_max[i]),
        minTemp: Math.round(daily.temperature_2m_min[i]),
        precipitation: Math.round((daily.precipitation_sum[i] || 0) * 10) / 10,
        windMax: Math.round(daily.windspeed_10m_max[i]),
        uvIndex: Math.round((daily.uv_index_max[i] || 0) * 10) / 10,
        et0: Math.round((daily.et0_fao_evapotranspiration[i] || 0) * 10) / 10, // mm/gün
        weatherCode: code,
        weatherLabel: wmo.label,
        weatherEmoji: wmo.emoji,
        // Suvarma tövsiyəsi: yağış < et0 → suvarma lazımdır
        irrigationNeeded: (daily.precipitation_sum[i] || 0) < (daily.et0_fao_evapotranspiration[i] || 0),
      };
    });

    // Bugünkü saatlıq temperatur (qrafor üçün)
    const hourly = meteo.hourly;
    const todayHours = hourly.time
      .map((t: string, i: number) => ({ time: t, temp: hourly.temperature_2m[i], humidity: hourly.relativehumidity_2m[i] }))
      .filter((h: any) => h.time.startsWith(daily.time[0]))
      .filter((_: any, i: number) => i % 3 === 0); // hər 3 saatdan biri

    return NextResponse.json({
      farmName,
      latitude,
      longitude,
      timezone: meteo.timezone,
      days,
      todayHours,
      totalRain7Days: Math.round(days.reduce((s: number, d: any) => s + d.precipitation, 0) * 10) / 10,
      avgTemp7Days: Math.round(days.reduce((s: number, d: any) => s + (d.maxTemp + d.minTemp) / 2, 0) / days.length),
      totalEt07Days: Math.round(days.reduce((s: number, d: any) => s + d.et0, 0) * 10) / 10,
    });
  } catch (err: any) {
    console.error('Weather API error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
