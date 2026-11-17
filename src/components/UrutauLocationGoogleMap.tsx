import React, { useEffect, useRef, useState } from 'react';
import {
  APIProvider,
  Map as GoogleMap,
  AdvancedMarker,
  InfoWindow,
  useMap,
  useMapsLibrary
} from '@vis.gl/react-google-maps';
import {
  CheckCircle2,
  Crosshair,
  Layers,
  LocateFixed,
  MapPin,
  MousePointerClick,
  Navigation,
  RefreshCw,
  Search,
  ShieldCheck
} from 'lucide-react';

export interface GpsLogTrackPoint {
  id: number;
  latitude: number;
  longitude: number;
  usuario?: string;
  cargo?: string;
  acaoLimpa: string;
  detalhesLimpos: string;
  dentro_empresa?: boolean;
  distancia_empresa_m?: number;
  tipo_telemetria?: string;
  aba?: string;
  em_turno?: boolean;
  criado_em?: string;
}

interface UrutauLocationGoogleMapProps {
  centerLat: number;
  centerLng: number;
  raioPermitidoMetros: number;
  enderecoSede?: string;
  points: GpsLogTrackPoint[];
  selectedPointId: number | null;
  onSelectPoint: (id: number) => void;
  onSaveSedeAddress?: (
    lat: number,
    lng: number,
    endereco: string,
    raioPermitidoMetros?: number
  ) => void;
  onReanchorLogs?: () => void;
  userGpsLocation?: {
    latitude: number;
    longitude: number;
    accuracy: number;
    simulated: boolean;
    label: string;
  };
}

function GeofenceAndTrailOverlays({
  centerLat,
  centerLng,
  raioPermitidoMetros,
  points,
  recenterTrigger
}: {
  centerLat: number;
  centerLng: number;
  raioPermitidoMetros: number;
  points: GpsLogTrackPoint[];
  recenterTrigger: number;
}) {
  const map = useMap();
  const mapsLib = useMapsLibrary('maps');
  const circleRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);

  useEffect(() => {
    if (!map || !mapsLib) return;

    if (!circleRef.current) {
      circleRef.current = new mapsLib.Circle({
        map,
        center: { lat: centerLat, lng: centerLng },
        radius: Math.max(25, Number(raioPermitidoMetros || 150)),
        strokeColor: '#10B981',
        strokeOpacity: 0.9,
        strokeWeight: 2,
        fillColor: '#10B981',
        fillOpacity: 0.16,
        clickable: false
      });
    } else {
      circleRef.current.setCenter({ lat: centerLat, lng: centerLng });
      circleRef.current.setRadius(Math.max(25, Number(raioPermitidoMetros || 150)));
      circleRef.current.setMap(map);
    }

    return () => {
      if (circleRef.current) {
        circleRef.current.setMap(null);
      }
    };
  }, [map, mapsLib, centerLat, centerLng, raioPermitidoMetros]);

  useEffect(() => {
    if (!map || !mapsLib) return;

    const pathCoords = points.map((pt) => ({
      lat: Number(pt.latitude),
      lng: Number(pt.longitude)
    }));

    if (pathCoords.length > 1) {
      if (!polylineRef.current) {
        polylineRef.current = new mapsLib.Polyline({
          map,
          path: pathCoords,
          geodesic: true,
          strokeColor: '#F59E0B',
          strokeOpacity: 0.9,
          strokeWeight: 3
        });
      } else {
        polylineRef.current.setPath(pathCoords);
        polylineRef.current.setMap(map);
      }
    } else if (polylineRef.current) {
      polylineRef.current.setMap(null);
    }

    return () => {
      if (polylineRef.current) {
        polylineRef.current.setMap(null);
      }
    };
  }, [map, mapsLib, points]);

  useEffect(() => {
    if (!map) return;
    map.panTo({ lat: centerLat, lng: centerLng });
    if (recenterTrigger > 0) {
      map.setZoom(16);
    }
  }, [map, recenterTrigger, centerLat, centerLng]);

  return null;
}

function SedeAddressRegistrationBar({
  centerLat,
  centerLng,
  raioPermitidoMetros,
  enderecoSede,
  pickMode,
  setPickMode,
  onApplyNewSede,
  onTriggerReanchorLogs,
  externalReverseTarget
}: {
  centerLat: number;
  centerLng: number;
  raioPermitidoMetros: number;
  enderecoSede?: string;
  pickMode: boolean;
  setPickMode: React.Dispatch<React.SetStateAction<boolean>>;
  onApplyNewSede: (lat: number, lng: number, endereco: string, raio: number) => void;
  onTriggerReanchorLogs: () => void;
  externalReverseTarget: { lat: number; lng: number; ts: number } | null;
}) {
  const map = useMap();
  const geocodingLib = useMapsLibrary('geocoding');
  const placesLib = useMapsLibrary('places');

  const [isOpen, setIsOpen] = useState<boolean>(true);
  const [addressQuery, setAddressQuery] = useState<string>(
    enderecoSede || 'Av. Visc. de Souza Franco, Belém - PA, Brasil'
  );
  const [manualLat, setManualLat] = useState<string>(String(centerLat));
  const [manualLng, setManualLng] = useState<string>(String(centerLng));
  const [manualRaio, setManualRaio] = useState<number>(Number(raioPermitidoMetros || 150));
  const [suggestions, setSuggestions] = useState<
    Array<{ placeId: string; text: string; placePrediction: any }>
  >([]);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);

  useEffect(() => {
    if (enderecoSede) setAddressQuery(enderecoSede);
  }, [enderecoSede]);

  useEffect(() => {
    setManualLat(String(Number(centerLat.toFixed(6))));
    setManualLng(String(Number(centerLng.toFixed(6))));
  }, [centerLat, centerLng]);

  useEffect(() => {
    setManualRaio(Number(raioPermitidoMetros || 150));
  }, [raioPermitidoMetros]);

  useEffect(() => {
    if (!externalReverseTarget) return;
    const { lat, lng } = externalReverseTarget;
    let cancelled = false;

    const resolveReverseAddress = async () => {
      setIsSearching(true);
      try {
        if (geocodingLib) {
          const geocoder = new geocodingLib.Geocoder();
          const res = await geocoder.geocode({ location: { lat, lng } });
          if (!cancelled && res.results && res.results[0]?.formatted_address) {
            const addr = res.results[0].formatted_address;
            setAddressQuery(addr);
            onApplyNewSede(lat, lng, addr, manualRaio);
            setStatusMessage(` Sede atualizada no mapa: ${addr}`);
            setIsSearching(false);
            return;
          }
        }
      } catch {
      }

      try {
        const resp = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=pt-BR`
        );
        const data = await resp.json();
        const addr =
          data?.display_name || `Sede (${lat.toFixed(5)}, ${lng.toFixed(5)})`;
        if (!cancelled) {
          setAddressQuery(addr);
          onApplyNewSede(lat, lng, addr, manualRaio);
          setStatusMessage(` Sede atualizada no mapa: ${addr}`);
        }
      } catch {
        const addr = `Sede (${lat.toFixed(5)}, ${lng.toFixed(5)})`;
        if (!cancelled) {
          setAddressQuery(addr);
          onApplyNewSede(lat, lng, addr, manualRaio);
          setStatusMessage(` Coordenadas da sede salvas: ${addr}`);
        }
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    };

    resolveReverseAddress();
    return () => {
      cancelled = true;
    };
  }, [externalReverseTarget]);

  const handleInputChange = async (val: string) => {
    setAddressQuery(val);
    if (!val || val.trim().length < 4 || !placesLib) {
      setSuggestions([]);
      return;
    }
    try {
      const AutocompleteSuggestion = (placesLib as any).AutocompleteSuggestion;
      if (AutocompleteSuggestion?.fetchAutocompleteSuggestions) {
        const response = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: val
        });
        const list = (response?.suggestions || [])
          .slice(0, 5)
          .map((s: any) => ({
            placeId: s.placePrediction?.placeId || String(Math.random()),
            text: s.placePrediction?.text?.text || '',
            placePrediction: s.placePrediction
          }))
          .filter((s: any) => Boolean(s.text));
        setSuggestions(list);
      }
    } catch {
      setSuggestions([]);
    }
  };

  const handleSelectSuggestion = async (item: {
    placeId: string;
    text: string;
    placePrediction: any;
  }) => {
    setSuggestions([]);
    setAddressQuery(item.text);
    setIsSearching(true);
    try {
      if (item.placePrediction?.toPlace) {
        const place = item.placePrediction.toPlace();
        await place.fetchFields({ fields: ['location', 'formattedAddress', 'displayName'] });
        if (place.location) {
          const lat = Number(place.location.lat().toFixed(6));
          const lng = Number(place.location.lng().toFixed(6));
          const formatted = place.formattedAddress || item.text;
          setAddressQuery(formatted);
          onApplyNewSede(lat, lng, formatted, manualRaio);
          if (map) {
            map.panTo({ lat, lng });
            map.setZoom(16);
          }
          setStatusMessage(` Endereço da Sede salvo: ${formatted}`);
          setIsSearching(false);
          return;
        }
      }
    } catch {
    }
    await handleSearchAddress(item.text);
  };

  const handleSearchAddress = async (overrideQuery?: string) => {
    const query = (overrideQuery ?? addressQuery).trim();
    if (!query) return;
    setSuggestions([]);
    setIsSearching(true);
    setStatusMessage('Buscando coordenadas do endereço...');

    try {
      if (geocodingLib) {
        const geocoder = new geocodingLib.Geocoder();
        const res = await geocoder.geocode({ address: query });
        if (res.results && res.results[0]?.geometry?.location) {
          const loc = res.results[0].geometry.location;
          const lat = Number(loc.lat().toFixed(6));
          const lng = Number(loc.lng().toFixed(6));
          const formatted = res.results[0].formatted_address || query;
          setAddressQuery(formatted);
          onApplyNewSede(lat, lng, formatted, manualRaio);
          if (map) {
            map.panTo({ lat, lng });
            map.setZoom(16);
          }
          setStatusMessage(` Sede cadastrada em: ${formatted}`);
          setIsSearching(false);
          return;
        }
      }
    } catch {
    }

    try {
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(
          query
        )}&accept-language=pt-BR`
      );
      const list = await resp.json();
      if (Array.isArray(list) && list[0]?.lat && list[0]?.lon) {
        const lat = Number(Number(list[0].lat).toFixed(6));
        const lng = Number(Number(list[0].lon).toFixed(6));
        const formatted = list[0].display_name || query;
        setAddressQuery(formatted);
        onApplyNewSede(lat, lng, formatted, manualRaio);
        if (map) {
          map.panTo({ lat, lng });
          map.setZoom(16);
        }
        setStatusMessage(` Sede cadastrada em: ${formatted}`);
      } else {
        setStatusMessage(
          ' Endereço não encontrado. Tente incluir Cidade/UF ou clique em "Clicar no Mapa para Definir a Sede".'
        );
      }
    } catch {
      setStatusMessage(
        ' Não foi possível consultar o endereço agora. Use o botão "Clicar no Mapa" ou digite Latitude/Longitude.'
      );
    } finally {
      setIsSearching(false);
    }
  };

  const handleUseMyDeviceGpsAsSede = () => {
    if (!navigator.geolocation) {
      setStatusMessage(' Seu navegador não suporta captura de GPS.');
      return;
    }
    setIsSearching(true);
    setStatusMessage('Capturando localização GPS do seu dispositivo...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        if (map) {
          map.panTo({ lat, lng });
          map.setZoom(16);
        }
        onApplyNewSede(lat, lng, `Minha Localização Atual (${lat}, ${lng})`, manualRaio);
        setStatusMessage(` Sede definida na sua localização GPS atual (${lat}, ${lng})!`);
        setIsSearching(false);
      },
      () => {
        setIsSearching(false);
        setStatusMessage(
          ' Permissão de GPS negada no navegador. Digite o endereço acima ou clique no mapa para definir a Sede.'
        );
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSaveManualCoords = () => {
    const lat = Number(manualLat);
    const lng = Number(manualLng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setStatusMessage(' Digite uma Latitude e Longitude válidas.');
      return;
    }
    onApplyNewSede(lat, lng, addressQuery || `Sede (${lat}, ${lng})`, manualRaio);
    if (map) {
      map.panTo({ lat, lng });
      map.setZoom(16);
    }
    setStatusMessage(` Sede salva em ${lat.toFixed(5)}, ${lng.toFixed(5)} (Raio ${manualRaio}m).`);
  };

  return (
    <div className="bg-[#091813] border-b border-emerald-500/30 px-3.5 py-3 space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
          <div className="text-xs">
            <span className="font-bold text-white"> Endereço da Sede da Empresa: </span>
            <span className="text-emerald-300 font-medium">
              {enderecoSede || 'Av. Visc. de Souza Franco, Belém - PA, Brasil'}
            </span>
            <span className="text-slate-400 font-mono text-[11px] ml-2">
              ({centerLat.toFixed(5)}, {centerLng.toFixed(5)})
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            data-no-confirm="true"
            onClick={() => setPickMode((prev) => !prev)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold inline-flex items-center gap-1.5 border cursor-pointer transition-colors ${
              pickMode
                ? 'bg-amber-500 text-slate-950 border-amber-300 shadow-lg'
                : 'bg-[#11151E] hover:bg-slate-800 text-amber-300 border-amber-500/40'
            }`}
          >
            <MousePointerClick className="w-3.5 h-3.5" />
            <span>
              {pickMode ? 'Modo Ativo: Clique em qualquer ponto do Mapa!' : ' Clicar no Mapa para Definir Sede'}
            </span>
          </button>

          <button
            type="button"
            data-no-confirm="true"
            onClick={handleUseMyDeviceGpsAsSede}
            className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <LocateFixed className="w-3.5 h-3.5" />
            <span> Usar Meu GPS Atual como Sede</span>
          </button>

          <button
            type="button"
            data-no-confirm="true"
            onClick={onTriggerReanchorLogs}
            className="px-2.5 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer"
            title="Traz todos os registros de cliques para o endereço da Sede atual"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span> Trazer Registros para Esta Sede</span>
          </button>

          <button
            type="button"
            data-no-confirm="true"
            onClick={() => setIsOpen((o) => !o)}
            className="px-2 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold cursor-pointer"
          >
            {isOpen ? 'Ocultar Cadastro' : ' Cadastrar / Alterar Endereço'}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="pt-1 space-y-2">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 items-start">
            
            <div className="lg:col-span-7 relative">
              <label className="block text-[10px] font-mono uppercase text-emerald-300 mb-1">
                Digite o Endereço, Rua, CEP ou Cidade da Sua Sede (No Seu País):
              </label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={addressQuery}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSearchAddress();
                    }
                  }}
                  placeholder="Ex: Av. Paulista 1000, São Paulo - SP, Brasil"
                  className="w-full px-3 py-1.5 bg-[#06110D] border border-slate-700 focus:border-emerald-400 rounded-lg text-xs text-white"
                />
                <button
                  type="button"
                  data-no-confirm="true"
                  disabled={isSearching}
                  onClick={() => handleSearchAddress()}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>{isSearching ? 'Buscando...' : 'Buscar & Definir Sede'}</span>
                </button>
              </div>

              {suggestions.length > 0 && (
                <div className="absolute z-30 left-0 right-0 mt-1 bg-[#0B1512] border border-emerald-500/40 rounded-lg shadow-2xl overflow-hidden">
                  {suggestions.map((item) => (
                    <button
                      key={item.placeId}
                      type="button"
                      data-no-confirm="true"
                      onClick={() => handleSelectSuggestion(item)}
                      className="w-full text-left px-3 py-2 text-xs text-slate-100 hover:bg-emerald-500/20 flex items-center gap-2 border-b border-slate-800/60 last:border-none cursor-pointer"
                    >
                      <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="truncate">{item.text}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            
            <div className="lg:col-span-5 grid grid-cols-3 gap-1.5 items-end">
              <div>
                <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                  Latitude Sede
                </label>
                <input
                  type="number"
                  step="0.0001"
                  value={manualLat}
                  onChange={(e) => setManualLat(e.target.value)}
                  className="w-full px-2 py-1.5 bg-[#06110D] border border-slate-700 rounded-lg text-xs font-mono text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                  Longitude Sede
                </label>
                <input
                  type="number"
                  step="0.0001"
                  value={manualLng}
                  onChange={(e) => setManualLng(e.target.value)}
                  className="w-full px-2 py-1.5 bg-[#06110D] border border-slate-700 rounded-lg text-xs font-mono text-white"
                />
              </div>
              <div className="flex gap-1">
                <div className="flex-1">
                  <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                    Raio (m)
                  </label>
                  <input
                    type="number"
                    min={20}
                    max={5000}
                    value={manualRaio}
                    onChange={(e) => setManualRaio(Math.max(20, Number(e.target.value || 150)))}
                    className="w-full px-2 py-1.5 bg-[#06110D] border border-slate-700 rounded-lg text-xs font-mono text-white"
                  />
                </div>
                <button
                  type="button"
                  data-no-confirm="true"
                  onClick={handleSaveManualCoords}
                  className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs inline-flex items-center justify-center shrink-0 cursor-pointer"
                  title="Salvar Latitude, Longitude e Raio da Sede"
                >
                  <CheckCircle2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {statusMessage && (
            <div className="text-[11px] font-medium text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-1.5 flex items-center justify-between">
              <span>{statusMessage}</span>
              <button
                type="button"
                data-no-confirm="true"
                onClick={() => setStatusMessage('')}
                className="text-slate-400 hover:text-white text-[10px] ml-2 cursor-pointer"
              >
                
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export const UrutauLocationGoogleMap: React.FC<UrutauLocationGoogleMapProps> = ({
  centerLat,
  centerLng,
  raioPermitidoMetros,
  enderecoSede,
  points,
  selectedPointId,
  onSelectPoint,
  onSaveSedeAddress,
  onReanchorLogs,
  userGpsLocation
}) => {
  const apiKey = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || '';
  const [mapTypeId, setMapTypeId] = useState<'roadmap' | 'hybrid'>('roadmap');
  const [infoOpenId, setInfoOpenId] = useState<number | null>(null);
  const [recenterTrigger, setRecenterTrigger] = useState<number>(0);
  const [pickMode, setPickMode] = useState<boolean>(false);
  const [externalReverseTarget, setExternalReverseTarget] = useState<{
    lat: number;
    lng: number;
    ts: number;
  } | null>(null);

  const activePoint =
    points.find((p) => Number(p.id) === Number(selectedPointId)) ||
    points[points.length - 1] ||
    null;

  const handleApplyNewSede = (lat: number, lng: number, endereco: string, raio: number) => {
    if (onSaveSedeAddress) {
      onSaveSedeAddress(lat, lng, endereco, raio);
    }
    setRecenterTrigger((c) => c + 1);
  };

  const handleTriggerReanchorLogs = () => {
    fetch('/api/erp/auditoria/reancorar-logs-sede', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        latitude: centerLat,
        longitude: centerLng,
        raio: raioPermitidoMetros
      })
    })
      .then(() => {
        if (onReanchorLogs) onReanchorLogs();
        setRecenterTrigger((c) => c + 1);
      })
      .catch(() => {});
  };

  if (!apiKey) {
    return (
      <div className="w-full h-[380px] sm:h-[430px] rounded-xl bg-[#06110D] border border-slate-800 flex flex-col items-center justify-center p-6 text-center space-y-2">
        <MapPin className="w-8 h-8 text-amber-400" />
        <div className="text-sm font-bold text-white">
          Chave do Google Maps não encontrada no ambiente
        </div>
        <p className="text-xs text-slate-400 max-w-md">
          Configure a variável <code className="text-emerald-300">VITE_GOOGLE_MAPS_API_KEY</code> para carregar o mapa cartográfico real do Google Maps.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full rounded-xl overflow-hidden border border-slate-800 bg-[#06110D] flex flex-col">
      <APIProvider apiKey={apiKey} libraries={['marker', 'maps', 'geocoding', 'places']}>
        
        <SedeAddressRegistrationBar
          centerLat={centerLat}
          centerLng={centerLng}
          raioPermitidoMetros={raioPermitidoMetros}
          enderecoSede={enderecoSede}
          pickMode={pickMode}
          setPickMode={setPickMode}
          onApplyNewSede={handleApplyNewSede}
          onTriggerReanchorLogs={handleTriggerReanchorLogs}
          externalReverseTarget={externalReverseTarget}
        />

        
        <div className="px-3.5 py-2 bg-[#071712] border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#10B981]/15 border border-[#10B981]/40 text-[#10B981] font-bold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Google Maps Real • Perímetro {raioPermitidoMetros}m</span>
            </span>
            {userGpsLocation && (
              <span className="text-[11px] font-mono text-slate-300 hidden sm:inline">
                Operador: {userGpsLocation.latitude.toFixed(5)}, {userGpsLocation.longitude.toFixed(5)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              data-no-confirm="true"
              onClick={() =>
                setMapTypeId((prev) => (prev === 'roadmap' ? 'hybrid' : 'roadmap'))
              }
              className="px-2.5 py-1 rounded-lg bg-[#0B0D11] hover:bg-slate-800 text-slate-200 border border-slate-700 text-[11px] font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              <span>{mapTypeId === 'roadmap' ? 'Ver Satélite / Híbrido' : 'Ver Mapa de Ruas'}</span>
            </button>

            <button
              type="button"
              data-no-confirm="true"
              onClick={() => setRecenterTrigger((c) => c + 1)}
              className="px-2.5 py-1 rounded-lg bg-[#10B981]/20 hover:bg-[#10B981]/30 text-[#10B981] border border-[#10B981]/40 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
              title="Centralizar na Sede da Empresa"
            >
              <Crosshair className="w-3.5 h-3.5" />
              <span>Centralizar na Sede</span>
            </button>
          </div>
        </div>

        
        <div className="w-full h-[380px] sm:h-[430px] relative">
          <GoogleMap
            mapId="DEMO_MAP_ID"
            internalUsageAttributionIds={['gmp_git_agentskills_v1']}
            defaultCenter={{ lat: centerLat, lng: centerLng }}
            defaultZoom={16}
            mapTypeId={mapTypeId}
            gestureHandling="greedy"
            disableDefaultUI={false}
            onClick={(ev: any) => {
              if (!pickMode) return;
              const latLng = ev?.detail?.latLng;
              if (latLng && typeof latLng.lat === 'number' && typeof latLng.lng === 'number') {
                const lat = Number(latLng.lat.toFixed(6));
                const lng = Number(latLng.lng.toFixed(6));
                setPickMode(false);
                setExternalReverseTarget({ lat, lng, ts: Date.now() });
              }
            }}
            className="w-full h-full"
          >
            <GeofenceAndTrailOverlays
              centerLat={centerLat}
              centerLng={centerLng}
              raioPermitidoMetros={raioPermitidoMetros}
              points={points}
              recenterTrigger={recenterTrigger}
            />

            
            <AdvancedMarker
              position={{ lat: centerLat, lng: centerLng }}
              title={`Sede da Empresa: ${enderecoSede || 'Sede Urutau'} (Raio Autorizado: ${raioPermitidoMetros}m)`}
            >
              <div className="px-2.5 py-1 rounded-full bg-[#071712] border-2 border-[#10B981] text-[#10B981] shadow-xl flex items-center gap-1.5 text-[11px] font-black whitespace-nowrap">
                <span className="w-2.5 h-2.5 rounded-full bg-[#10B981] animate-ping" />
                <span> SEDE DA EMPRESA ({raioPermitidoMetros}m)</span>
              </div>
            </AdvancedMarker>

            
            {userGpsLocation && (
              <AdvancedMarker
                position={{
                  lat: Number(userGpsLocation.latitude),
                  lng: Number(userGpsLocation.longitude)
                }}
                title={`Sua Posição Atual: ${userGpsLocation.label}`}
              >
                <div className="w-7 h-7 rounded-full bg-amber-500 border-2 border-white shadow-lg flex items-center justify-center text-slate-950 font-black text-xs">
                  <Navigation className="w-3.5 h-3.5" />
                </div>
              </AdvancedMarker>
            )}

            
            {points.map((pt, idx) => {
              const inside = pt.dentro_empresa !== false;
              const isSelected = activePoint && Number(activePoint.id) === Number(pt.id);
              const bgHex = !inside
                ? '#F43F5E'
                : pt.tipo_telemetria === 'EXECUCAO_SISTEMA'
                ? '#F59E0B'
                : pt.tipo_telemetria === 'ABERTURA_MENU'
                ? '#38BDF8'
                : '#10B981';

              return (
                <AdvancedMarker
                  key={pt.id}
                  position={{ lat: Number(pt.latitude), lng: Number(pt.longitude) }}
                  onClick={() => {
                    onSelectPoint(pt.id);
                    setInfoOpenId(pt.id);
                  }}
                  title={`${idx + 1}. ${pt.usuario || 'Operador'} — ${pt.acaoLimpa}`}
                >
                  <div
                    style={{ backgroundColor: bgHex }}
                    className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-[11px] font-mono font-black text-[#05100C] shadow-lg transition-transform cursor-pointer ${
                      isSelected ? 'scale-125 border-white ring-4 ring-white/40' : 'border-[#05100C]'
                    }`}
                  >
                    {idx + 1}
                  </div>
                </AdvancedMarker>
              );
            })}

            
            {activePoint && infoOpenId === activePoint.id && (
              <InfoWindow
                position={{
                  lat: Number(activePoint.latitude),
                  lng: Number(activePoint.longitude)
                }}
                onCloseClick={() => setInfoOpenId(null)}
                maxWidth={260}
              >
                <div className="text-slate-900 space-y-1 text-xs p-0.5">
                  <div className="font-bold text-slate-950 flex items-center justify-between gap-2">
                    <span>Log #{activePoint.id}</span>
                    <span
                      className={`font-mono text-[10px] px-1.5 py-0.5 rounded ${
                        activePoint.dentro_empresa !== false
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {activePoint.dentro_empresa !== false
                        ? `Na Empresa (${activePoint.distancia_empresa_m ?? 0}m)`
                        : `Fora (${activePoint.distancia_empresa_m ?? 890}m)`}
                    </span>
                  </div>
                  <div className="font-semibold text-slate-800">{activePoint.usuario}</div>
                  <div className="font-mono text-[11px] text-amber-700 font-bold">
                    {activePoint.acaoLimpa}
                  </div>
                  <div className="text-[11px] text-slate-600">{activePoint.detalhesLimpos}</div>
                </div>
              </InfoWindow>
            )}
          </GoogleMap>
        </div>
      </APIProvider>

      
      <div className="px-3.5 py-2 bg-[#05100C]/95 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[#10B981]">● Clique / Na Empresa</span>
          <span className="text-sky-400">● Abertura de Menu</span>
          <span className="text-amber-400">● Execução de Sistema</span>
          <span className="text-rose-400">● Fora da Empresa / Bloqueado</span>
        </div>
        <span className="text-slate-400">
          Centro Sede: {centerLat.toFixed(4)}, {centerLng.toFixed(4)}
        </span>
      </div>
    </div>
  );
};
