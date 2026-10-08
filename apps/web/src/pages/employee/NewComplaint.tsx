import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createComplaintSchema, CreateComplaintInput } from '@complaintease/shared';
import { api } from '../../lib/api-client.js';
import {
  Send,
  ArrowLeft,
  AlertCircle,
  MapPin,
  Crosshair,
  Camera,
  UploadCloud,
  X,
  ExternalLink,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { LocationMap } from '../../components/common/LocationMap.js';

export const NewComplaint: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  // Live Geolocation state
  const [coords, setCoords] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [locationAddress, setLocationAddress] = useState('');

  // Image Upload state
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFileName, setImageFileName] = useState<string | null>(null);
  const [imageFileSize, setImageFileSize] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Fetch departments & categories
  const { data: departments = [], isLoading: deptsLoading } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.departments.list(),
  });

  const { data: categories = [], isLoading: catsLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.categories.list(),
  });

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateComplaintInput>({
    resolver: zodResolver(createComplaintSchema),
    defaultValues: {
      priority: 'medium',
    },
  });

  const selectedDept = watch('department_id');
  const filteredCategories = selectedDept
    ? categories.filter((c) => !c.department_id || c.department_id === selectedDept)
    : categories;

  // Geolocation Handlers
  const handleCaptureLocation = () => {
    setGeoLoading(true);
    setGeoError(null);
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by your browser.');
      setGeoLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setCoords({ lat: latitude, lng: longitude, accuracy });
        if (!locationAddress) {
          setLocationAddress(`Live GPS Fix (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`);
        }
        setGeoLoading(false);
      },
      (error) => {
        let msg = 'Failed to acquire device location.';
        if (error.code === error.PERMISSION_DENIED) {
          msg = 'Location permission denied by browser. Please enable location permissions or enter physical machinery bay below.';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          msg = 'Location information is currently unavailable.';
        } else if (error.code === error.TIMEOUT) {
          msg = 'Location acquisition timed out. Please retry.';
        }
        setGeoError(msg);
        setGeoLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  };

  const handleClearLocation = () => {
    setCoords(null);
    setLocationAddress('');
    setGeoError(null);
  };

  // Image Upload Handlers
  const handleFileProcess = (file: File) => {
    setImageError(null);
    if (!file.type.startsWith('image/')) {
      setImageError('Only image formats (JPEG, PNG, WebP) are supported.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setImageError('Image file size must be less than 10MB.');
      return;
    }

    setImageFileName(file.name);
    setImageFileSize(`${(file.size / 1024).toFixed(1)} KB`);

    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileProcess(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileProcess(file);
  };

  const handleClearImage = () => {
    setImagePreview(null);
    setImageFileName(null);
    setImageFileSize(null);
    setImageError(null);
  };

  const onSubmit = async (data: CreateComplaintInput) => {
    setServerError(null);
    try {
      const payload: CreateComplaintInput = {
        ...data,
        location_lat: coords ? coords.lat : null,
        location_lng: coords ? coords.lng : null,
        location_address:
          locationAddress.trim() ||
          (coords ? `GPS: ${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}` : null),
        image_url: imagePreview || null,
      };

      const result = await api.complaints.create(payload);
      await queryClient.invalidateQueries({ queryKey: ['complaints'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-complaints-feed'] });
      navigate(`/complaints/${result.id}`);
    } catch (err: any) {
      setServerError(err.message || 'Failed to submit complaint');
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center space-x-3">
        <Link
          to="/employee"
          className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Report Plant Incident / Issue</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Submit a plant machinery, electrical, or safety incident with live GPS coordinates and photo evidence forwarded directly to plant operations.
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
        {serverError && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{serverError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Department Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Target Department *
              </label>
              <select
                {...register('department_id')}
                className="w-full px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none transition-all"
              >
                <option value="">{deptsLoading ? 'Loading departments...' : 'Select Department...'}</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
              {errors.department_id && (
                <p className="text-xs text-rose-600 mt-1">{errors.department_id.message}</p>
              )}
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Category *
              </label>
              <select
                {...register('category_id')}
                className="w-full px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none transition-all"
              >
                <option value="">{catsLoading ? 'Loading categories...' : 'Select Category...'}</option>
                {filteredCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
              {errors.category_id && (
                <p className="text-xs text-rose-600 mt-1">{errors.category_id.message}</p>
              )}
            </div>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              Urgency / Priority Tier
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(['low', 'medium', 'high', 'critical'] as const).map((tier) => (
                <label
                  key={tier}
                  className="flex items-center justify-center space-x-2 p-2.5 border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/60 rounded-xl cursor-pointer text-xs font-medium capitalize transition-all hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200"
                >
                  <input
                    type="radio"
                    value={tier}
                    {...register('priority')}
                    className="text-brand-600 focus:ring-brand-500"
                  />
                  <span>{tier}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Incident Subject / Title *
            </label>
            <input
              {...register('title')}
              placeholder="Concise summary (e.g. 500-Ton Hydraulic Press primary cylinder pressure drop)"
              className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-brand-500 outline-none transition-all"
            />
            {errors.title && (
              <p className="text-xs text-rose-600 mt-1">{errors.title.message}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Comprehensive Technical Description *
            </label>
            <textarea
              {...register('description')}
              rows={4}
              placeholder="Provide machine telemetry, observed gauge pressures, abnormal acoustics, and safety hazard impact (minimum 20 characters)..."
              className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-brand-500 outline-none resize-none transition-all"
            />
            {errors.description && (
              <p className="text-xs text-rose-600 mt-1">{errors.description.message}</p>
            )}
          </div>

          {/* ======================================================== */}
          {/* SECTION 1: LIVE INCIDENT GEOLOCATION */}
          {/* ======================================================== */}
          <div className="p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-3 transition-colors">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shadow-xs">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                    Live Geolocation & Incident Site
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Capture real-time GPS coordinates to forward physical location to the administrator.
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {!coords ? (
                  <>
                    <button
                      type="button"
                      onClick={handleCaptureLocation}
                      disabled={geoLoading}
                      className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-md shadow-emerald-600/20 hover:shadow-emerald-600/30 transition-all transform hover:-translate-y-0.5 disabled:opacity-50"
                    >
                      {geoLoading ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Acquiring GPS...</span>
                        </>
                      ) : (
                        <>
                          <Crosshair className="w-3.5 h-3.5" />
                          <span>Capture Live Location</span>
                        </>
                      )}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={handleClearLocation}
                    className="inline-flex items-center space-x-1 text-xs text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 px-2.5 py-1 rounded-lg transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Clear Location</span>
                  </button>
                )}
              </div>
            </div>

            {geoError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{geoError}</span>
              </div>
            )}

            {coords && (
              <div className="p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-emerald-200 dark:border-emerald-800/80 shadow-sm space-y-2.5 transition-colors">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2 text-emerald-800 dark:text-emerald-300 font-semibold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Live Coordinates Captured Successfully</span>
                  </div>
                  <a
                    href={`https://www.google.com/maps?q=${coords.lat},${coords.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-1 text-brand-600 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-300 font-semibold text-[11px]"
                  >
                    <span>Preview in Maps</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-mono bg-slate-50 dark:bg-slate-800/80 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/60">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block font-sans">
                      Latitude
                    </span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{coords.lat.toFixed(6)}°</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block font-sans">
                      Longitude
                    </span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{coords.lng.toFixed(6)}°</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block font-sans">
                      GPS Accuracy
                    </span>
                    <span className="text-slate-700 dark:text-slate-300 font-medium">
                      {coords.accuracy ? `± ${Math.round(coords.accuracy)}m` : 'High'}
                    </span>
                  </div>
                </div>

                {/* Live OpenStreetMap Interactive Map */}
                <div className="pt-1">
                  <LocationMap
                    lat={coords.lat}
                    lng={coords.lng}
                    address={locationAddress || 'Incident GPS Coordinates'}
                    height="190px"
                    title="Live Location Map"
                  />
                </div>
              </div>
            )}

            {/* Landmark / Address input */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Machinery Sector, Bay Number, or Physical Landmark (Forwarded to Admin)
              </label>
              <input
                type="text"
                value={locationAddress}
                onChange={(e) => setLocationAddress(e.target.value)}
                placeholder="e.g. Sector B - Heavy Machinery Bay 4, Boiler House Mezzanine, or MCC Substation Panel 2"
                className="w-full px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-brand-500 transition-all"
              />
            </div>
          </div>

          {/* ======================================================== */}
          {/* SECTION 2: PHOTO / IMAGE EVIDENCE UPLOAD */}
          {/* ======================================================== */}
          <div className="p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-3 transition-colors">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 flex items-center justify-center shadow-xs">
                  <Camera className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                    Incident Photo & Image Evidence
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Attach machinery damage, pipe leaks, or gauge reading photos for administrator review.
                  </p>
                </div>
              </div>
            </div>

            {imageError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{imageError}</span>
              </div>
            )}

            {!imagePreview ? (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-2xl p-6 text-center transition-colors ${
                  isDragging
                    ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-950/40'
                    : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 bg-white dark:bg-slate-850'
                }`}
              >
                <div className="mx-auto w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-2">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Drag and drop an image here, or{' '}
                  <label className="text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 underline cursor-pointer font-bold">
                    browse files
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileInputChange}
                      className="hidden"
                    />
                  </label>
                </p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                  Supports JPEG, PNG, WebP up to 10MB. Camera capture enabled on mobile.
                </p>
              </div>
            ) : (
              <div className="p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between gap-4 transition-colors">
                <div className="flex items-center space-x-3 truncate">
                  <img
                    src={imagePreview}
                    alt="Incident preview"
                    className="w-16 h-16 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                  />
                  <div className="truncate">
                    <span className="text-xs font-bold text-slate-900 dark:text-white block truncate">
                      {imageFileName || 'incident_image.jpg'}
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 block">{imageFileSize || 'Image attached'}</span>
                    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">
                      <CheckCircle2 className="w-3 h-3" /> Ready to forward to admin
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleClearImage}
                  className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors shrink-0"
                  title="Remove image"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center space-x-2 px-7 py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-brand-600/25 hover:shadow-brand-600/35 transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>{isSubmitting ? 'Filing Complaint...' : 'Submit Complaint to Admin'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
