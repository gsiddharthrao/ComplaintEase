import React, { useState } from 'react';
import { MapPin, ExternalLink, Maximize2, Minimize2, Navigation } from 'lucide-react';

interface LocationMapProps {
  lat: number;
  lng: number;
  address?: string | null;
  height?: string;
  title?: string;
  showExpand?: boolean;
  className?: string;
}

export const LocationMap: React.FC<LocationMapProps> = ({
  lat,
  lng,
  address,
  height = '220px',
  title = 'Incident Location Map',
  showExpand = true,
  className = '',
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Delta bounding box (~500m zoom level)
  const deltaLat = 0.005;
  const deltaLng = 0.006;
  const bbox = `${lng - deltaLng}%2C${lat - deltaLat}%2C${lng + deltaLng}%2C${lat + deltaLat}`;
  const embedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}`;
  const gmapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
  const osmUrl = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;

  const renderMapIframe = (customHeight: string) => (
    <div className="relative w-full rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-inner bg-slate-100 dark:bg-slate-900">
      <iframe
        title={title}
        width="100%"
        height={customHeight}
        frameBorder="0"
        scrolling="no"
        marginHeight={0}
        marginWidth={0}
        src={embedUrl}
        className="w-full block"
      />
      {/* Interactive Map Overlay Controls */}
      <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 z-10">
        <a
          href={gmapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="Open in Google Maps"
          className="p-1.5 bg-white/95 dark:bg-slate-900/90 hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 hover:text-emerald-700 dark:hover:text-emerald-400 rounded-lg shadow-md border border-slate-200 dark:border-slate-700 text-xs font-semibold flex items-center gap-1 backdrop-blur transition-all"
        >
          <Navigation className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span className="hidden sm:inline text-[11px]">Navigate</span>
        </a>

        <a
          href={osmUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="Open in OpenStreetMap"
          className="p-1.5 bg-white/95 dark:bg-slate-900/90 hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 hover:text-blue-700 dark:hover:text-blue-400 rounded-lg shadow-md border border-slate-200 dark:border-slate-700 text-xs font-semibold flex items-center gap-1 backdrop-blur transition-all"
        >
          <ExternalLink className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <span className="hidden sm:inline text-[11px]">OSM</span>
        </a>

        {showExpand && (
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? 'Collapse Map' : 'Full Screen Map'}
            className="p-1.5 bg-white/95 dark:bg-slate-900/90 hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 hover:text-brand-700 dark:hover:text-brand-400 rounded-lg shadow-md border border-slate-200 dark:border-slate-700 text-xs font-semibold flex items-center gap-1 backdrop-blur transition-all"
          >
            {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      {/* Pin Details Badge */}
      <div className="absolute bottom-2 left-2 right-2 flex flex-wrap items-center justify-between gap-1.5 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-slate-200/80 dark:border-slate-800 shadow-sm text-xs pointer-events-none">
        <div className="flex items-center gap-1.5 min-w-0 pointer-events-auto">
          <MapPin className="w-3.5 h-3.5 text-rose-600 dark:text-rose-500 shrink-0 animate-bounce" />
          <span className="font-semibold text-slate-900 dark:text-white truncate">
            {address || 'Live Pin Location'}
          </span>
        </div>
        <span className="font-mono text-[11px] text-slate-600 dark:text-slate-400 shrink-0">
          {lat.toFixed(5)}°, {lng.toFixed(5)}°
        </span>
      </div>
    </div>
  );

  return (
    <div className={`space-y-1.5 ${className}`}>
      {renderMapIframe(height)}

      {/* Expanded Modal */}
      {isExpanded && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6"
          onClick={() => setIsExpanded(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-3xl max-w-4xl w-full overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/80">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                  Live Incident Geolocation Map {address ? `— ${address}` : ''}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={gmapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1 transition-colors"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  <span>Google Maps</span>
                </a>
                <button
                  type="button"
                  onClick={() => setIsExpanded(false)}
                  className="p-1 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                >
                  <Minimize2 className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-3 bg-slate-100 dark:bg-slate-950">
              {renderMapIframe('480px')}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

