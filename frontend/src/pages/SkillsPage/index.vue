<template>
  <div class="skills-page">
    <SkillsHeaderSection
      :is-admin="isAdmin"
      :stats-open="statsOpen"
      :stats="stats"
      :banner-dismissed="bannerDismissed"
      :categories="categories"
      :sort-options="sortOptions"
      :fav-only="favOnly"
      :search-q="searchQ"
      :filter-cat="filterCat"
      :sort-by="sortBy"
      @open-guide="guideOpen = true"
      @toggle-stats="toggleStats"
      @open-create="createOpen = true"
      @download-bootstrap="downloadBootstrapAndCopy"
      @dismiss-banner="dismissBanner"
      @update:search-q="searchQ = $event"
      @update:filter-cat="filterCat = $event"
      @update:sort-by="sortBy = $event"
      @update:fav-only="favOnly = $event"
    />

    <SkillsSpecCard
      :is-admin="isAdmin"
      :spec-editing="specEditing"
      :spec-saving="specSaving"
      :spec-draft="specDraft"
      :spec-content="specContent"
      @update:spec-editing="specEditing = $event"
      @update:spec-draft="specDraft = $event"
      @save="saveSpec"
      @cancel-edit="cancelSpecEdit"
    />

    <div v-if="loading" class="skills-loading"><a-spin size="large" /></div>
    <a-empty v-else-if="skills.length === 0" description="暂无 Skills" />
    <div v-else class="skills-grid">
      <SkillCardItem
        v-for="s in skills"
        :key="s.name"
        :skill="s"
        :is-admin="isAdmin"
        :can-edit="canEdit"
        :cat-label="catLabel"
        @open-detail="openDetail"
        @toggle-fav="toggleFav"
        @vote="vote"
        @set-pinned="setPinned"
        @open-edit="openEdit"
        @remove="removeSkill"
        @download="downloadAndCopy"
      />
    </div>

    <a-drawer :open="detailOpen" :title="detailSkill?.name" :width="680" @close="closeDetail">
      <template v-if="detailSkill">
        <p>{{ detailSkill.description || "暂无描述" }}</p>
        <a-space class="skills-detail-meta">
          <a-tag>{{ catLabel(detailSkill.category) }}</a-tag>
          <a-tag>v{{ detailSkill.version || "1.0.0" }}</a-tag>
          <span>{{ detailSkill.downloads }} 次下载</span>
        </a-space>
        <a-space style="margin: 12px 0">
          <a-button size="small" @click="toggleFav(detailSkill)">
            <template #icon><StarOutlined :style="{ color: detailSkill.favorited ? '#faad14' : undefined }" /></template>
          </a-button>
          <a-button size="small" @click="vote(detailSkill, 'up')">
            <template #icon><LikeOutlined /></template>
          </a-button>
          <a-button size="small" @click="vote(detailSkill, 'down')">
            <template #icon><DislikeOutlined /></template>
          </a-button>
          <a-button v-if="isAdmin" size="small" @click="setPinned(detailSkill, !detailSkill.pinned)">
            <template #icon><PushpinOutlined /></template>
          </a-button>
          <a-button v-if="canEdit(detailSkill)" size="small" @click="openEdit(detailSkill)">
            <template #icon><EditOutlined /></template>
          </a-button>
          <a-button v-if="canEdit(detailSkill)" size="small" danger @click="removeSkill(detailSkill)">
            <template #icon><DeleteOutlined /></template>
          </a-button>
          <a-button type="primary" class="skills-primary-btn" @click="downloadAndCopy(detailSkill.name)">
            <template #icon><DownloadOutlined /></template>
            下载 Skill
          </a-button>
        </a-space>

        <a-card size="small" class="skills-install-card">
          <template #title>安装命令</template>
          <template #extra>
            <a-space>
              <a-radio-group v-model:value="cmdTarget" size="small">
                <a-radio-button value="openclaw">openclaw</a-radio-button>
                <a-radio-button value="claude">Claude</a-radio-button>
              </a-radio-group>
              <a-radio-group v-model:value="cmdOS" size="small">
                <a-radio-button value="mac"><AppleOutlined /> Mac</a-radio-button>
                <a-radio-button value="win"><WindowsOutlined /> Win</a-radio-button>
              </a-radio-group>
            </a-space>
          </template>
          <div class="skills-install-row">
            <code>{{ getInstallCmd(detailSkill.name) }}</code>
            <a-button size="small" @click="copyText(getInstallCmd(detailSkill.name), '安装命令已复制')">
              <template #icon><CopyOutlined /></template>
              复制
            </a-button>
          </div>
        </a-card>

        <a-divider>文件预览</a-divider>
        <a-list :data-source="detailSkill.files || []" size="small" bordered>
          <template #renderItem="{ item }">
            <a-list-item @click="preview(detailSkill.name, item.name)" class="skills-file-row">
              <a-space><FileTextOutlined /> {{ item.name }}</a-space>
              <span>{{ item.size }} B</span>
            </a-list-item>
          </template>
        </a-list>
        <a-card v-if="previewName" class="skills-preview" size="small">
          <template #title>{{ previewName }}</template>
          <a-spin :spinning="previewLoading">
            <MarkdownView v-if="previewName.toLowerCase().endsWith('.md')" :content="previewContent" />
            <pre v-else>{{ previewContent }}</pre>
          </a-spin>
        </a-card>

        <a-divider>评论</a-divider>
        <a-space.Compact class="skills-comment-input">
          <a-input v-model:value="commentText" placeholder="写一条简评（200 字以内）" />
          <a-button type="primary" class="skills-primary-btn" :loading="commentLoading" @click="submitComment">
            <template #icon><SendOutlined /></template>
          </a-button>
        </a-space.Compact>
        <a-list :data-source="comments" size="small" style="margin-top: 8px">
          <template #renderItem="{ item, index }">
            <a-list-item>
              <a-list-item-meta :title="item.user_name" :description="item.content" />
              <a-button v-if="item.user_id === user?.id || isAdmin" size="small" type="link" danger @click="deleteOneComment(index)">删除</a-button>
            </a-list-item>
          </template>
        </a-list>
      </template>
    </a-drawer>

    <a-modal
      v-model:open="createOpen"
      title="发布新 Skill"
      ok-text="发布"
      cancel-text="取消"
      :confirm-loading="createLoading"
      @ok="submitCreate"
      @cancel="resetCreate"
    >
      <a-form layout="vertical">
        <a-form-item label="名称"><a-input v-model:value="newForm.name" placeholder="英文小写，如 code-reviewer" /></a-form-item>
        <a-form-item label="描述"><a-input v-model:value="newForm.description" /></a-form-item>
        <a-form-item label="分类"><a-select v-model:value="newForm.category" :options="categories.filter((c) => c.value)" /></a-form-item>
        <a-form-item label="来源"><a-select v-model:value="newForm.source" :options="sourceOptions" /></a-form-item>
        <a-form-item label="版本号"><a-input v-model:value="newForm.version" /></a-form-item>
        <a-form-item label="更新日志"><a-input v-model:value="newForm.changelog" /></a-form-item>
        <a-form-item label="文件包(.zip)">
          <a-upload-dragger :before-upload="onCreateFile" :file-list="createFileList" :max-count="1" @remove="removeCreateFile">
            <p>拖拽或点击上传 .zip</p>
          </a-upload-dragger>
        </a-form-item>
      </a-form>
    </a-modal>

    <a-modal v-model:open="editOpen" title="编辑 Skill" ok-text="保存" cancel-text="取消" :confirm-loading="editLoading" @ok="submitEdit">
      <a-form layout="vertical">
        <a-form-item label="描述"><a-input v-model:value="editForm.description" /></a-form-item>
        <a-form-item label="分类"><a-select v-model:value="editForm.category" :options="categories.filter((c) => c.value)" /></a-form-item>
        <a-form-item label="来源"><a-select v-model:value="editForm.source" :options="sourceOptions" /></a-form-item>
        <a-form-item label="版本号"><a-input v-model:value="editForm.version" /></a-form-item>
        <a-form-item label="更新日志"><a-input v-model:value="editForm.changelog" /></a-form-item>
        <a-form-item label="替换文件包(.zip)">
          <a-upload-dragger :before-upload="onEditFile" :file-list="editFileList" :max-count="1" @remove="removeEditFile">
            <p>拖拽或点击上传 .zip</p>
          </a-upload-dragger>
        </a-form-item>
      </a-form>
    </a-modal>

    <SkillsGuideModal :open="guideOpen" @close="guideOpen = false" @download-bootstrap="downloadBootstrapAndCopy" />

    <a-card class="skills-external" size="small">
      <template #title>找不到想要的 Skill？去外部广场看看</template>
      <a-space wrap>
        <a :href="'https://smithery.ai'" target="_blank" rel="noopener noreferrer">Smithery</a>
        <a :href="'https://github.com/punkpeye/awesome-mcp-servers'" target="_blank" rel="noopener noreferrer">GitHub MCP</a>
        <a :href="'https://cursor.directory'" target="_blank" rel="noopener noreferrer">Cursor Directory</a>
      </a-space>
    </a-card>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { message, Modal } from "ant-design-vue";
import { getStoredUser } from "@/utils/authStorage";
import MarkdownView from "@/components/MarkdownView.vue";
import SkillsHeaderSection from "./components/SkillsHeaderSection.vue";
import SkillsSpecCard from "./components/SkillsSpecCard.vue";
import SkillCardItem from "./components/SkillCardItem.vue";
import SkillsGuideModal from "./components/SkillsGuideModal.vue";
import {
  addComment, createSkill, deleteComment, deleteSkill, downloadSkill, getSkillStats, getSpecification, listComments, listSkills,
  pinSkill, previewFile, toggleFavorite, updateSkill, updateSpecification, voteSkill,
} from "@/api/skills";
import {
  DeleteOutlined, DislikeOutlined, DownloadOutlined, EditOutlined, FileTextOutlined, LikeOutlined, PushpinOutlined,
  SendOutlined, StarOutlined, AppleOutlined, WindowsOutlined, CopyOutlined,
} from "@ant-design/icons-vue";

const user = getStoredUser();
const isAdmin = computed(() => user?.role === "admin");
const loading = ref(false);
const skills = ref([]);
const searchQ = ref("");
const filterCat = ref("");
const sortBy = ref("default");
const favOnly = ref(false);
const categories = [
  { value: "", label: "全部分类" },
  { value: "dev-tools", label: "开发工具" },
  { value: "text", label: "文本处理" },
  { value: "data", label: "数据分析" },
  { value: "automation", label: "自动化" },
  { value: "other", label: "其他" },
];
const sortOptions = [
  { value: "default", label: "默认排序" },
  { value: "newest", label: "最新发布" },
  { value: "most_downloads", label: "最多下载" },
  { value: "recently_updated", label: "最近更新" },
];
const sourceOptions = [
  { value: "internal", label: "内部开发" },
  { value: "external", label: "外部下载" },
];
const guideOpen = ref(false);
const bannerDismissed = ref(localStorage.getItem("skills_banner_dismissed") === "1");
const cmdOS = ref(/Win/i.test(navigator.userAgent) ? "win" : "mac");
const cmdTarget = ref("openclaw");

const statsOpen = ref(false);
const stats = ref(null);

const detailOpen = ref(false);
const detailSkill = ref(null);
const comments = ref([]);
const commentText = ref("");
const commentLoading = ref(false);
const previewName = ref("");
const previewContent = ref("");
const previewLoading = ref(false);

const createOpen = ref(false);
const createLoading = ref(false);
const createFile = ref(null);
const newForm = ref({ name: "", description: "", category: "other", source: "internal", version: "1.0.0", changelog: "" });

const editOpen = ref(false);
const editLoading = ref(false);
const editFile = ref(null);
const editTargetName = ref("");
const editForm = ref({ description: "", category: "other", source: "internal", version: "1.0.0", changelog: "" });

const specContent = ref("");
const specDraft = ref("");
const specEditing = ref(false);
const specSaving = ref(false);

const createFileList = computed(() => (createFile.value ? [{ uid: "create", name: createFile.value.name, status: "done" }] : []));
const editFileList = computed(() => (editFile.value ? [{ uid: "edit", name: editFile.value.name, status: "done" }] : []));

const fetchSkills = async () => {
  loading.value = true;
  try {
    const res = await listSkills(searchQ.value, filterCat.value, sortBy.value, favOnly.value);
    skills.value = res.data || [];
  } finally {
    loading.value = false;
  }
};

const fetchSpecification = async () => {
  const res = await getSpecification();
  specContent.value = res.data.content || "";
  specDraft.value = specContent.value;
};

const toggleStats = async () => {
  if (statsOpen.value) {
    statsOpen.value = false;
    return;
  }
  const res = await getSkillStats();
  stats.value = res.data;
  statsOpen.value = true;
};

const catLabel = (v) => categories.find((c) => c.value === v)?.label || v;
const canEdit = (s) => isAdmin.value || s.author_id === user?.id;
const macCmd = (name, target = "openclaw") => {
  const dir = target === "claude" ? "~/.claude/skills" : "~/.openclaw/skills";
  return `mkdir -p ${dir} && unzip -o ~/Downloads/${name}.zip -d ${dir}/ && rm ~/Downloads/${name}.zip`;
};
const winCmd = (name, target = "openclaw") => {
  const dir = target === "claude" ? "%USERPROFILE%\\.claude\\skills" : "%USERPROFILE%\\.openclaw\\skills";
  return `mkdir ${dir} 2>nul & tar -xf %USERPROFILE%\\Downloads\\${name}.zip -C ${dir} & del %USERPROFILE%\\Downloads\\${name}.zip`;
};
const getInstallCmd = (name) => (cmdOS.value === "mac" ? macCmd(name, cmdTarget.value) : winCmd(name, cmdTarget.value));
const copyText = async (text, successMsg = "已复制") => {
  await navigator.clipboard.writeText(text);
  message.success(successMsg);
};
const dismissBanner = () => {
  bannerDismissed.value = true;
  localStorage.setItem("skills_banner_dismissed", "1");
};

const downloadSkillZip = async (name) => {
  const res = await downloadSkill(name);
  const url = URL.createObjectURL(new Blob([res.data], { type: "application/zip" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  message.success("下载成功");
  await fetchSkills();
};
const downloadAndCopy = async (name) => {
  await downloadSkillZip(name);
  await copyText(getInstallCmd(name), "下载成功，安装命令已复制");
};
const downloadBootstrapAndCopy = async () => {
  const a = document.createElement("a");
  a.href = "/api/cli/skills/bootstrap/download";
  a.download = "openclaw-skills-guide.zip";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  const cmd = cmdOS.value === "mac"
    ? "mkdir -p ~/.openclaw/skills && unzip -o ~/Downloads/openclaw-skills-guide.zip -d ~/.openclaw/skills/ && rm ~/Downloads/openclaw-skills-guide.zip"
    : "mkdir %USERPROFILE%\\.openclaw\\skills 2>nul & tar -xf %USERPROFILE%\\Downloads\\openclaw-skills-guide.zip -C %USERPROFILE%\\.openclaw\\skills & del %USERPROFILE%\\Downloads\\openclaw-skills-guide.zip";
  await copyText(cmd, "下载成功，安装命令已复制");
};

const toggleFav = async (s) => { await toggleFavorite(s.name, !s.favorited); await fetchSkills(); };
const vote = async (s, target) => { await voteSkill(s.name, s.my_vote === target ? "none" : target); await fetchSkills(); };
const setPinned = async (s, pinned) => { await pinSkill(s.name, pinned); await fetchSkills(); };
const removeSkill = (s) => Modal.confirm({ title: `确认删除 ${s.name} ?`, okButtonProps: { danger: true }, onOk: async () => { await deleteSkill(s.name); await fetchSkills(); } });

const openDetail = async (s) => {
  detailSkill.value = s;
  detailOpen.value = true;
  previewName.value = "";
  previewContent.value = "";
  const res = await listComments(s.name);
  comments.value = res.data || [];
};
const closeDetail = () => { detailOpen.value = false; detailSkill.value = null; };

const preview = async (skillName, fileName) => {
  previewName.value = fileName;
  previewLoading.value = true;
  try {
    const res = await previewFile(skillName, fileName);
    previewContent.value = res.data.content || "";
  } finally {
    previewLoading.value = false;
  }
};

const submitComment = async () => {
  if (!detailSkill.value || !commentText.value.trim()) return;
  commentLoading.value = true;
  try {
    const res = await addComment(detailSkill.value.name, commentText.value.trim());
    comments.value = res.data || [];
    commentText.value = "";
  } finally {
    commentLoading.value = false;
  }
};
const deleteOneComment = async (index) => {
  const res = await deleteComment(detailSkill.value.name, index);
  comments.value = res.data || [];
};

const onCreateFile = (file) => { createFile.value = file; return false; };
const removeCreateFile = () => { createFile.value = null; };
const onEditFile = (file) => { editFile.value = file; return false; };
const removeEditFile = () => { editFile.value = null; };

const resetCreate = () => { createFile.value = null; };

const submitCreate = async () => {
  if (!newForm.value.name.trim() || !createFile.value) {
    message.warning("请填写名称并上传 zip");
    return;
  }
  createLoading.value = true;
  try {
    const fd = new FormData();
    Object.entries(newForm.value).forEach(([k, v]) => fd.append(k, v));
    fd.append("file", createFile.value);
    await createSkill(fd);
    message.success("发布成功");
    createOpen.value = false;
    createFile.value = null;
    newForm.value = { name: "", description: "", category: "other", source: "internal", version: "1.0.0", changelog: "" };
    await fetchSkills();
  } finally {
    createLoading.value = false;
  }
};

const openEdit = (s) => {
  editTargetName.value = s.name;
  editForm.value = {
    description: s.description || "",
    category: s.category || "other",
    source: s.source || "internal",
    version: s.version || "1.0.0",
    changelog: s.changelog || "",
  };
  editFile.value = null;
  editOpen.value = true;
};

const submitEdit = async () => {
  if (!editTargetName.value) return;
  editLoading.value = true;
  try {
    const fd = new FormData();
    Object.entries(editForm.value).forEach(([k, v]) => fd.append(k, v));
    if (editFile.value) fd.append("file", editFile.value);
    await updateSkill(editTargetName.value, fd);
    message.success("更新成功");
    editOpen.value = false;
    await fetchSkills();
  } finally {
    editLoading.value = false;
  }
};

const saveSpec = async () => {
  specSaving.value = true;
  try {
    const res = await updateSpecification(specDraft.value);
    specContent.value = res.data.content || "";
    specEditing.value = false;
    message.success("规范已保存");
  } finally {
    specSaving.value = false;
  }
};
const cancelSpecEdit = () => { specDraft.value = specContent.value; specEditing.value = false; };

watch([searchQ, filterCat, sortBy, favOnly], fetchSkills);

onMounted(async () => {
  await Promise.all([fetchSkills(), fetchSpecification()]);
});
</script>

<style scoped>
.skills-page { padding-top: 40px; }
.skills-primary-btn.ant-btn-primary { background: #000 !important; border-color: #000 !important; }
.skills-loading { text-align: center; padding: 80px; }
.skills-grid { display: grid; gap: 12px; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); }
.skills-detail-meta { margin-bottom: 8px; color: #666; }
.skills-file-row { cursor: pointer; }
.skills-preview { margin-top: 10px; }
.skills-preview pre { margin: 0; max-height: 300px; overflow: auto; white-space: pre-wrap; }
.skills-comment-input { width: 100%; }
.skills-install-card { margin-bottom: 12px; }
.skills-install-row { display: flex; gap: 8px; align-items: center; }
.skills-install-row code {
  flex: 1;
  font-size: 12px;
  background: #141414;
  color: #a3e635;
  border-radius: 6px;
  padding: 8px 10px;
  overflow: auto;
  white-space: nowrap;
}
.skills-external { margin-top: 24px; }
</style>
