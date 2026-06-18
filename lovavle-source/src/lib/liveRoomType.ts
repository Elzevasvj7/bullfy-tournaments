export type NormalizedLiveRoomType = "broadcast" | "meeting" | "webinar_pro" | "bullfy_family";

export const normalizeLiveRoomType = (roomType?: string | null): NormalizedLiveRoomType => {
  switch (roomType) {
    case "meeting":
    case "webinar_pro":
    case "bullfy_family":
    case "broadcast":
      return roomType;
    default:
      return "broadcast";
  }
};

export const isMeetingRoomType = (roomType?: string | null) => {
  const normalizedRoomType = normalizeLiveRoomType(roomType);
  return normalizedRoomType === "meeting" || normalizedRoomType === "webinar_pro" || normalizedRoomType === "bullfy_family";
};