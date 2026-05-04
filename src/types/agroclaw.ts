export type DemoPrompt = {
  id: string;
  title: string;
  goal: string;
  prompt: string;
};

export type AgroClawRequest = {
  message: string;
  mode: "demo";
  source: "agroclaw-demo-frontend";
};

export type AgroClawResponse = {
  answer: string;
};
