import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8010/api/v1",
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const isLoginRequest =
    config.url === "/auth/login" || config.url?.endsWith("/auth/login");

  if (!isLoginRequest) {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }

  return config;
});

export async function resolveCommunity() {
  const existingId = localStorage.getItem("communityId") || import.meta.env.VITE_COMMUNITY_ID;
  const existingName = localStorage.getItem("communityName");
  if (existingId && existingName) {
    return { id: existingId, name: existingName };
  }

  const response = await api.get("/communities");
  const communities = response.data || [];
  if (!communities.length) {
    throw new Error("No communities available in API.");
  }

  const selected = communities.find((item) => item.id === existingId) || communities[0];
  localStorage.setItem("communityId", selected.id);
  localStorage.setItem("communityName", selected.name);
  return { id: selected.id, name: selected.name };
}

export function getCommunityId() {
  return localStorage.getItem("communityId") || import.meta.env.VITE_COMMUNITY_ID;
}

export function clearSession() {
  localStorage.removeItem("token");
  localStorage.removeItem("communityId");
  localStorage.removeItem("communityName");
}

export default api;
