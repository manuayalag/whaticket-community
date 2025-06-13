import axios from "axios";

const api = axios.create({
  baseURL: process.env.REACT_APP_BACKEND_URL,
});

export const getOpenAISettings = async () => {
  const { data } = await api.get("/openai/settings");
  return data;
};

export const saveOpenAISettings = async (settings) => {
  const { data } = await api.post("/openai/settings", settings);
  return data;
};

export const sendOpenAIMessage = async (message) => {
  const { data } = await api.post("/openai/message", { message });
  return data;
};
