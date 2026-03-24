import client from "./client";

export const listSkills = (q, category, sort, favoritesOnly) => {
  const params = {};
  if (q) params.q = q;
  if (category) params.category = category;
  if (sort) params.sort = sort;
  if (favoritesOnly) params.favorites_only = "true";
  return client.get("/skills", { params });
};

export const createSkill = (data) =>
  client.post("/skills", data, {
    headers: { "Content-Type": "multipart/form-data" },
  });

export const updateSkill = (name, data) =>
  client.put(`/skills/${name}`, data, {
    headers: { "Content-Type": "multipart/form-data" },
  });

export const deleteSkill = (name) => client.delete(`/skills/${name}`);
export const downloadSkill = (name) => client.get(`/skills/${name}/download`, { responseType: "blob" });
export const pinSkill = (name, pinned) => client.put(`/skills/${name}/pin`, { pinned });
export const toggleFavorite = (name, favorite) => client.put(`/skills/${name}/favorite`, { favorite });
export const voteSkill = (name, vote) => client.put(`/skills/${name}/vote`, { vote });
export const previewFile = (skillName, filePath) => client.get(`/skills/${skillName}/files/${filePath}`);
export const listComments = (name) => client.get(`/skills/${name}/comments`);
export const addComment = (name, content) => client.post(`/skills/${name}/comments`, { content });
export const deleteComment = (name, index) => client.delete(`/skills/${name}/comments/${index}`);
export const getSkillStats = () => client.get("/skills/stats/overview");
export const getSpecification = () => client.get("/skills/specification");
export const updateSpecification = (content) => client.put("/skills/specification", { content });
