import { useMemo } from "react";

export const getSessionId = (): string => {
  let id = localStorage.getItem("bullfy_exp_session");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("bullfy_exp_session", id);
  }
  return id;
};

export const useExperienceSession = () => {
  const sessionId = useMemo(() => getSessionId(), []);
  return { sessionId };
};
