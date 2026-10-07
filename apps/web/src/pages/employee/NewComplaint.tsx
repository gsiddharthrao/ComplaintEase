import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { createComplaintSchema, CreateComplaintInput } from '@complaintease/shared';
import { api } from '../../lib/api-client.js';
import {
  Send,
  ArrowLeft,
  AlertCircle,
  MapPin,
  Crosshair,
  Camera,
  Image as ImageIcon,
  UploadCloud,
  X,
  ExternalLink,
  CheckCircle2,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { LocationMap } from '../../components/common/LocationMap.js';

export const NewComplaint: React.FC = () => {
  const navigate = useNavigate();
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
  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.admin.getDepartments(),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.admin.getCategories(),
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
          msg = 'Location permission denied by browser. Click "Use Campus Demo Coordinates" or enable location permission.';
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

  const handleUseDemoLocation = () => {
    setCoords({ lat: 28.535516, lng: 77.391026, accuracy: 5 });
    setLocationAddress('Plant Sector B - Heavy Machinery Bay 4 (Press Station #4)');
    setGeoError(null);
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

  const handleUseDemoImage = () => {
    setImagePreview(
      'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80',
    );
    setImageFileName('hydraulic_manifold_pressure_leak.jpg');
    setImageFileSize('684 KB');
    setImageError(null);
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
          className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Report Plant Incident / Issue</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Submit a plant machinery, electrical, or safety incident with live GPS coordinates and photo evidence forwarded directly to plant operations.
          </p>
        </div>
      </div>

      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm">
        {serverError && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{serverError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Department Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Target Department *
              </label>
              <select
                {...register('department_id')}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-brand-500 outline-none"
              >
                <option value="">Select Department...</option>
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
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Category *
              </label>
              <select
                {...register('category_id')}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-brand-500 outline-none"
              >
                <option value="">Select Category...</option>
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
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Urgency / Priority Tier
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(['low', 'medium', 'high', 'critical'] as const).map((tier) => (
                <label
                  key={tier}
                  className="flex items-center justify-center space-x-2 p-2.5 border rounded-lg cursor-pointer text-xs font-medium capitalize transition-all hover:bg-slate-50"
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
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Incident Subject / Title *
            </label>
            <input
              {...register('title')}
              placeholder="Concise summary (e.g. 500-Ton Hydraulic Press primary cylinder pressure drop)"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none"
            />
            {errors.title && (
              <p className="text-xs text-rose-600 mt-1">{errors.title.message}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Comprehensive Technical Description *
            </label>
            <textarea
              {...register('description')}
              rows={4}
              placeholder="Provide machine telemetry, observed gauge pressures, abnormal acoustics, and safety hazard impact (minimum 20 characters)..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none resize-none"
            />
            {errors.description && (
              <p className="text-xs text-rose-600 mt-1">{errors.description.message}</p>
            )}
          </div>

          {/* ======================================================== */}
          {/* SECTION 1: LIVE INCIDENT GEOLOCATION */}
          {/* ======================================================== */}
          <div className="p-4 sm:p-5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    Live Geolocation & Incident Site
                  </h3>
                  <p className="text-[11px] text-slate-500">
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
                      className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50"
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
                    <button
                      type="button"
                      onClick={handleUseDemoLocation}
                      className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-medium rounded-lg transition-colors"
                      title="Quick fill sample plant floor coordinates"
                    >
                      <Sparkles className="w-3 h-3 text-amber-500" />
                      <span>Plant Floor Demo Pin</span>
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={handleClearLocation}
                    className="inline-flex items-center space-x-1 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2 py-1 rounded transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Clear Location</span>
                  </button>
                )}
              </div>
            </div>

            {geoError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{geoError}</span>
              </div>
            )}

            {coords && (
              <div className="p-3 bg-white rounded-lg border border-emerald-200 shadow-sm space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2 text-emerald-800 font-semibold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Live Coordinates Captured Successfully</span>
                  </div>
                  <a
                    href={`https://www.google.com/maps?q=${coords.lat},${coords.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-1 text-brand-600 hover:text-brand-800 font-semibold text-[11px]"
                  >
                    <span>Preview in Maps</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-mono bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block font-sans">
                      Latitude
                    </span>
                    <span className="font-semibold text-slate-800">{coords.lat.toFixed(6)}°</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block font-sans">
                      Longitude
                    </span>
                    <span className="font-semibold text-slate-800">{coords.lng.toFixed(6)}°</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block font-sans">
                      GPS Accuracy
                    </span>
                    <span className="text-slate-700 font-medium">
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
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Machinery Sector, Bay Number, or Physical Landmark (Forwarded to Admin)
              </label>
              <input
                type="text"
                value={locationAddress}
                onChange={(e) => setLocationAddress(e.target.value)}
                placeholder="e.g. Sector B - Heavy Machinery Bay 4, Boiler House Mezzanine, or MCC Substation Panel 2"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          {/* ======================================================== */}
          {/* SECTION 2: PHOTO / IMAGE EVIDENCE UPLOAD */}
          {/* ======================================================== */}
          <div className="p-4 sm:p-5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
                  <Camera className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    Incident Photo & Image Evidence
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Attach machinery damage, pipe leaks, or gauge reading photos for administrator review.
                  </p>
                </div>
              </div>

              {!imagePreview && (
                <button
                  type="button"
                  onClick={handleUseDemoImage}
                  className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-medium rounded-lg transition-colors"
                  title="Quick fill sample machinery incident photo"
                >
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  <span>Plant Incident Photo</span>
                </button>
              )}
            </div>

            {imageError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{imageError}</span>
              </div>
            )}

            {!imagePreview ? (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
                  isDragging
                    ? 'border-brand-500 bg-brand-50/50'
                    : 'border-slate-300 hover:border-slate-400 bg-white'
                }`}
              >
                <div className="mx-auto w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mb-2">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <p className="text-xs font-semibold text-slate-800">
                  Drag and drop an image here, or{' '}
                  <label className="text-brand-600 hover:text-brand-700 underline cursor-pointer font-bold">
                    browse files
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileInputChange}
                      className="hidden"
                    />
                  </label>
                </p>
                <p className="text-[10px] text-slate-400 mt-1">
                  Supports JPEG, PNG, WebP up to 10MB. Camera capture enabled on mobile.
                </p>
              </div>
            ) : (
              <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center justify-between gap-4">
                <div className="flex items-center space-x-3 truncate">
                  <img
                    src={imagePreview}
                    alt="Incident preview"
                    className="w-16 h-16 rounded-lg object-cover border border-slate-200 shrink-0"
                  />
                  <div className="truncate">
                    <span className="text-xs font-bold text-slate-900 block truncate">
                      {imageFileName || 'incident_image.jpg'}
                    </span>
                    <span className="text-[10px] text-slate-400 block">{imageFileSize || 'Image attached'}</span>
                    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 font-semibold mt-0.5">
                      <CheckCircle2 className="w-3 h-3" /> Ready to forward to admin
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleClearImage}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors shrink-0"
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
              className="inline-flex items-center space-x-2 px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm rounded-xl shadow-sm transition-colors disabled:opacity-50"
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
