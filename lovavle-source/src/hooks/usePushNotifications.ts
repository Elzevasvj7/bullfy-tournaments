import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { isPushSupported, subscribeToPush, getPushPermission } from "@/lib/pushNotifications";

export const usePushNotifications = () => {
  const { user } = useAuth();
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    isPushSupported().then(setSupported);
    getPushPermission().then(setPermission);
  }, []);

  // Auto-subscribe on login if permission already granted
  useEffect(() => {
    if (user && supported && permission === "granted") {
      subscribeToPush(user.id).then(setSubscribed);
    }
  }, [user, supported, permission]);

  const requestPermission = useCallback(async () => {
    if (!user || !supported) return false;
    const result = await subscribeToPush(user.id);
    setSubscribed(result);
    if (result) setPermission("granted");
    return result;
  }, [user, supported]);

  return { supported, permission, subscribed, requestPermission };
};
