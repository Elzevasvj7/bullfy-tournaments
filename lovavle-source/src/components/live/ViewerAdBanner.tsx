import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X, ExternalLink } from "lucide-react";

interface AdCampaign {
  id: string;
  name: string;
  image_path: string;
  frequency_seconds: number;
  duration_seconds: number;
  cta_url: string | null;
}

const ViewerAdBanner = () => {
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([]);
  const [currentAd, setCurrentAd] = useState<AdCampaign | null>(null);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const indexRef = useRef(0);

  useEffect(() => {
    fetchCampaigns();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  const fetchCampaigns = async () => {
    const { data } = await supabase
      .from("live_ad_campaigns")
      .select("id, name, image_path, frequency_seconds, duration_seconds, cta_url")
      .eq("active", true);
    const ads = (data as unknown as AdCampaign[]) || [];
    setCampaigns(ads);
  };

  const getImageUrl = (path: string) => {
    const { data } = supabase.storage.from("live-ads").getPublicUrl(path);
    return data.publicUrl;
  };

  // Sequential scheduler: shows one ad at a time, waits for it to hide, then schedules next
  const showAd = useCallback((ads: AdCampaign[], idx: number) => {
    if (ads.length === 0) return;
    const ad = ads[idx % ads.length];

    setCurrentAd(ad);
    setVisible(true);

    // Auto-hide after duration, then schedule next after its frequency delay
    hideTimerRef.current = setTimeout(() => {
      setVisible(false);
      const nextIdx = (idx + 1) % ads.length;
      indexRef.current = nextIdx;
      const nextAd = ads[nextIdx];
      timerRef.current = setTimeout(() => {
        showAd(ads, nextIdx);
      }, nextAd.frequency_seconds * 1000);
    }, ad.duration_seconds * 1000);
  }, []);

  // Start the cycle when campaigns load
  useEffect(() => {
    if (campaigns.length === 0) return;

    // Clear any existing timers
    if (timerRef.current) clearTimeout(timerRef.current);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);

    // Show first ad after 20s
    timerRef.current = setTimeout(() => {
      showAd(campaigns, 0);
    }, 20000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [campaigns, showAd]);

  const handleDismiss = () => {
    setVisible(false);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    // Schedule next ad after a short delay
    if (campaigns.length > 0) {
      const nextIdx = (indexRef.current + 1) % campaigns.length;
      indexRef.current = nextIdx;
      const nextAd = campaigns[nextIdx];
      timerRef.current = setTimeout(() => {
        showAd(campaigns, nextIdx);
      }, nextAd.frequency_seconds * 1000);
    }
  };

  const handleAdClick = () => {
    if (currentAd?.cta_url) {
      window.open(currentAd.cta_url, "_blank", "noopener,noreferrer");
    }
  };

  if (!visible || !currentAd) return null;

  const hasCta = !!currentAd.cta_url;

  return (
    <div className="absolute inset-x-0 bottom-14 z-30 animate-in slide-in-from-bottom-4 duration-500">
      <div className="relative w-full">
        {/* Dismiss button */}
        <button
          onClick={handleDismiss}
          className="absolute top-1 right-1 z-10 bg-black/70 hover:bg-black text-white rounded-full p-1 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Ad container */}
        <div
          onClick={hasCta ? handleAdClick : undefined}
          className={`overflow-hidden ${hasCta ? "cursor-pointer" : ""}`}
        >
          <img
            src={getImageUrl(currentAd.image_path)}
            alt={currentAd.name}
            className="w-full h-auto max-h-[200px] object-cover"
          />
          {hasCta && (
            <div className="flex items-center justify-center gap-1.5 py-1.5 bg-primary/90 text-primary-foreground text-xs font-medium">
              <ExternalLink className="w-3 h-3" />
              Toca para más información
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ViewerAdBanner;
