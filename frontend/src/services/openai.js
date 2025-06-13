import api from "./api";

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
