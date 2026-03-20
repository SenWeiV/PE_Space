import { useEffect, useRef, useState } from "react";
import { Input, Select, Tag, Spin, Modal, message, Empty, Drawer, Upload, Tooltip, Skeleton } from "antd";
import {
  SearchOutlined,
  PlusOutlined,
  DownloadOutlined,
  PushpinOutlined,
  PushpinFilled,
  EditOutlined,
  DeleteOutlined,
  UserOutlined,
  EyeOutlined,
  FileZipOutlined,
  FileTextOutlined,
  InboxOutlined,
  ArrowLeftOutlined,
  CopyOutlined,
  AppleOutlined,
  WindowsOutlined,
  StarOutlined,
  StarFilled,
  BarChartOutlined,
  HistoryOutlined,
  QuestionCircleOutlined,
  LikeOutlined,
  LikeFilled,
  DislikeOutlined,
  DislikeFilled,
  MessageOutlined,
  SendOutlined,
  FileProtectOutlined,
} from "@ant-design/icons";
import ReactMarkdown from "react-markdown";
import { useAuthStore } from "@/store/authStore";
import {
  listSkills,
  createSkill,
  updateSkill,
  deleteSkill,
  downloadSkill,
  pinSkill,
  previewFile,
  toggleFavorite,
  getSkillStats,
  voteSkill,
  listComments,
  addComment,
  deleteComment,
  getSpecification,
  updateSpecification,
  type Skill,
  type SkillComment,
  type SkillStats,
} from "@/api/skills";

/* ── Constants ── */
const CATEGORIES = [
  { value: "", label: "全部分类" },
  { value: "dev-tools", label: "开发工具" },
  { value: "text", label: "文本处理" },
  { value: "data", label: "数据分析" },
  { value: "automation", label: "自动化" },
  { value: "other", label: "其他" },
];
const CAT_LABEL: Record<string, string> = { "dev-tools": "开发工具", text: "文本处理", data: "数据分析", automation: "自动化", other: "其他" };
const SORT_OPTIONS = [
  { value: "default", label: "默认排序" },
  { value: "newest", label: "最新发布" },
  { value: "most_downloads", label: "最多下载" },
  { value: "recently_updated", label: "最近更新" },
];

/* ── Helpers ── */
const isWin = /Win/i.test(navigator.userAgent);
function fmtSize(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}
const PREVIEW_EXTS = new Set([".md",".txt",".py",".js",".ts",".jsx",".tsx",".json",".yaml",".yml",".toml",".cfg",".ini",".sh",".bash",".zsh",".css",".html",".xml",".csv",".sql",".rs",".go",".java",".rb",".php",".c",".h",".cpp",".swift",".kt",".r",".lua",".pl",".env",".gitignore",".dockerfile"]);
const isHidden = (n: string) => n.startsWith("__MACOSX") || (n.split("/").pop() || "").startsWith("._") || n.endsWith(".DS_Store");
const canPreview = (n: string) => { const d = n.toLowerCase().lastIndexOf("."); return d !== -1 && PREVIEW_EXTS.has(n.toLowerCase().slice(d)); };
function sortFiles(files: { name: string; size: number }[]) {
  return [...files].filter((f) => !isHidden(f.name)).sort((a, b) => {
    const pa = canPreview(a.name) ? 0 : 1, pb = canPreview(b.name) ? 0 : 1;
    if (pa !== pb) return pa - pb;
    if (a.name.endsWith("/SKILL.md") || a.name === "SKILL.md") return -1;
    if (b.name.endsWith("/SKILL.md") || b.name === "SKILL.md") return 1;
    return a.name.localeCompare(b.name);
  });
}

/* ── Styles ── */
const TIP_DELAY = 0.15; // tooltip 150ms delay
const label: React.CSSProperties = { fontSize: 13, fontWeight: 500, color: "#333", display: "block", marginBottom: 6 };
const iconBtn: React.CSSProperties = { background: "none", border: "1px solid #e5e5e5", borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontSize: 12, color: "#666", display: "flex", alignItems: "center", gap: 3 };
const pillBtn = (active: boolean, color = "#1677ff"): React.CSSProperties => ({
  display: "inline-flex", alignItems: "center", gap: 4, padding: "0 12px", height: 32,
  background: active ? color : "transparent", color: active ? "#fff" : "#666",
  border: `1px solid ${active ? color : "#d9d9d9"}`, borderRadius: 6,
  fontSize: 12, fontWeight: 500, cursor: "pointer", transition: "all 0.15s",
});

/* ────────────────────────────────────────────────────────────────── */
export default function SkillsPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === "admin";

  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQ, setSearchQ] = useState("");
  const [filterCat, setFilterCat] = useState("");
  const [sortBy, setSortBy] = useState("default");
  const [favOnly, setFavOnly] = useState(false);
  const [pageSize, setPageSize] = useState(12);
  const searchRef = useRef<HTMLInputElement>(null);

  // create
  const [createOpen, setCreateOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newCat, setNewCat] = useState("other");
  const [newFile, setNewFile] = useState<File | null>(null);
  const [newVersion, setNewVersion] = useState("1.0.0");
  const [newChangelog, setNewChangelog] = useState("");
  const [newSource, setNewSource] = useState<"internal" | "external">("internal");

  // detail
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailSkill, setDetailSkill] = useState<Skill | null>(null);

  // edit info modal
  const [editOpen, setEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editDesc, setEditDesc] = useState("");
  const [editCat, setEditCat] = useState("other");
  const [editFile, setEditFile] = useState<File | null>(null);

  // edit changelog modal
  const [changelogOpen, setChangelogOpen] = useState(false);
  const [changelogLoading, setChangelogLoading] = useState(false);
  const [editVersion, setEditVersion] = useState("");
  const [editChangelog, setEditChangelog] = useState("");

  // preview
  const [pvName, setPvName] = useState("");
  const [pvContent, setPvContent] = useState("");
  const [pvLoading, setPvLoading] = useState(false);

  // comments
  const [comments, setComments] = useState<SkillComment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);

  // misc
  const [cmdOS, setCmdOS] = useState<"mac" | "win">(isWin ? "win" : "mac");
  const [cmdTarget, setCmdTarget] = useState<"openclaw" | "claude">("openclaw");
  const [statsOpen, setStatsOpen] = useState(false);
  const [stats, setStats] = useState<SkillStats | null>(null);

  const [guideOpen, setGuideOpen] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(() => localStorage.getItem("skills_banner_dismissed") === "1");

  // specification
  const [specContent, setSpecContent] = useState("");
  const [specDraft, setSpecDraft] = useState("");
  const [specEditing, setSpecEditing] = useState(false);
  const [specSaving, setSpecSaving] = useState(false);
  const [specExpanded, setSpecExpanded] = useState(false);
  const [specLoaded, setSpecLoaded] = useState(false);

  /* ── Data ── */
  const fetchSkills = async () => {
    try { setSkills((await listSkills(searchQ, filterCat, sortBy, favOnly)).data); }
    catch { /* */ }
    finally { setLoading(false); }
  };
  useEffect(() => { setLoading(true); fetchSkills(); }, [searchQ, filterCat, sortBy, favOnly]);

  // Load spec on mount
  useEffect(() => {
    getSpecification().then((res) => {
      const c = res.data.content || "";
      setSpecContent(c); setSpecDraft(c); setSpecLoaded(true);
    }).catch(() => { setSpecLoaded(true); });
  }, []);

  // Reset page size when filters change
  useEffect(() => { setPageSize(12); }, [searchQ, filterCat, sortBy, favOnly]);

  // Keyboard shortcut: press "/" to focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  /* ── Handlers ── */
  const handleCreate = async () => {
    if (!newName.trim()) return message.warning("请输入 Skill 名称");
    if (!newFile) return message.warning("请上传 .zip 文件");
    setCreateLoading(true);
    try {
      const fd = new FormData();
      fd.append("name", newName.trim()); fd.append("description", newDesc); fd.append("category", newCat);
      fd.append("version", newVersion); fd.append("changelog", newChangelog); fd.append("source", newSource); fd.append("file", newFile);
      await createSkill(fd);
      message.success("发布成功");
      setCreateOpen(false); setNewName(""); setNewDesc(""); setNewCat("other"); setNewFile(null); setNewVersion("1.0.0"); setNewChangelog(""); setNewSource("internal");
      fetchSkills();
    } catch (e: any) { message.error(e.response?.data?.detail || "发布失败"); }
    finally { setCreateLoading(false); }
  };

  const handleDownload = async (name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await downloadSkill(name);
      const url = URL.createObjectURL(new Blob([res.data], { type: "application/zip" }));
      const a = document.createElement("a"); a.href = url; a.download = `${name}.zip`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
      message.success("下载成功"); fetchSkills();
    } catch (err: any) { message.error(err.response?.data?.detail || "下载失败"); }
  };
  const handlePin = async (s: Skill, e: React.MouseEvent) => { e.stopPropagation(); try { await pinSkill(s.name, !s.pinned); fetchSkills(); } catch { message.error("操作失败"); } };
  const handleFav = async (s: Skill, e: React.MouseEvent) => { e.stopPropagation(); try { await toggleFavorite(s.name, !s.favorited); fetchSkills(); } catch { message.error("操作失败"); } };
  const handleDelete = (s: Skill, e: React.MouseEvent) => {
    e.stopPropagation();
    Modal.confirm({
      title: `确认删除「${s.name}」？`, content: "删除后不可恢复", okText: "删除", okButtonProps: { danger: true }, cancelText: "取消",
      onOk: async () => { try { await deleteSkill(s.name); message.success("已删除"); if (detailSkill?.name === s.name) { setDetailOpen(false); setDetailSkill(null); } fetchSkills(); } catch (err: any) { message.error(err.response?.data?.detail || "删除失败"); } },
    });
  };
  const canEdit = (s: Skill) => isAdmin || s.author_id === user?.id;
  const handleVote = async (s: Skill, vote: "up" | "down", e: React.MouseEvent) => {
    e.stopPropagation();
    const newVote = s.my_vote === vote ? "none" : vote;
    try { await voteSkill(s.name, newVote); fetchSkills(); } catch { message.error("投票失败"); }
  };

  // Edit info
  const openEditInfo = (s: Skill, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditDesc(s.description); setEditCat(s.category); setEditFile(null); setDetailSkill(s); setEditOpen(true);
  };
  const handleEditInfo = async () => {
    if (!detailSkill) return;
    setEditLoading(true);
    try {
      const fd = new FormData(); fd.append("description", editDesc); fd.append("category", editCat);
      if (editFile) fd.append("file", editFile);
      await updateSkill(detailSkill.name, fd);
      message.success("更新成功"); setEditOpen(false); fetchSkills();
    } catch (err: any) { message.error(err.response?.data?.detail || "更新失败"); }
    finally { setEditLoading(false); }
  };

  // Edit changelog
  const openEditChangelog = (s: Skill, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditVersion(s.version || "1.0.0"); setEditChangelog(s.changelog || ""); setDetailSkill(s); setChangelogOpen(true);
  };
  const handleEditChangelog = async () => {
    if (!detailSkill) return;
    setChangelogLoading(true);
    try {
      const fd = new FormData(); fd.append("version", editVersion); fd.append("changelog", editChangelog);
      await updateSkill(detailSkill.name, fd);
      message.success("更新成功"); setChangelogOpen(false); fetchSkills();
    } catch (err: any) { message.error(err.response?.data?.detail || "更新失败"); }
    finally { setChangelogLoading(false); }
  };

  const openDetail = async (s: Skill) => {
    setDetailSkill(s); setDetailOpen(true); setComments([]); setCommentText("");
    try { setComments((await listComments(s.name)).data); } catch { /* */ }
  };
  const handleAddComment = async () => {
    if (!detailSkill || !commentText.trim()) return;
    setCommentLoading(true);
    try { setComments((await addComment(detailSkill.name, commentText.trim())).data); setCommentText(""); }
    catch (e: any) { message.error(e.response?.data?.detail || "评论失败"); }
    finally { setCommentLoading(false); }
  };
  const handleDeleteComment = async (index: number) => {
    if (!detailSkill) return;
    try { setComments((await deleteComment(detailSkill.name, index)).data); } catch { message.error("删除失败"); }
  };
  const handleToggleStats = async () => {
    if (statsOpen) return setStatsOpen(false);
    try { setStats((await getSkillStats()).data); setStatsOpen(true); } catch { message.error("获取统计失败"); }
  };
  const handlePreviewFile = async (skillName: string, fileName: string) => {
    setPvLoading(true); setPvName(fileName); setPvContent("");
    try { setPvContent((await previewFile(skillName, fileName)).data.content); }
    catch (err: any) { setPvContent(err.response?.data?.detail || "无法预览"); }
    finally { setPvLoading(false); }
  };
  const closePv = () => { setPvName(""); setPvContent(""); };

  const openSpec = async () => {
    if (specLoaded) { setSpecExpanded(!specExpanded); return; }
    try {
      const c = (await getSpecification()).data.content || "";
      setSpecContent(c);
      setSpecDraft(c);
      setSpecLoaded(true);
    } catch { /* */ }
    setSpecExpanded(true);
  };
  const handleSaveSpec = async () => {
    setSpecSaving(true);
    try {
      const res = (await updateSpecification(specDraft)).data;
      setSpecContent(res.content);
      setSpecEditing(false);
      message.success("规范已保存");
    } catch { message.error("保存失败"); }
    finally { setSpecSaving(false); }
  };

  const macCmd = (n: string, target: "openclaw" | "claude" = "openclaw") => {
    const dir = target === "claude" ? "~/.claude/skills" : "~/.openclaw/skills";
    return `mkdir -p ${dir} && unzip -o ~/Downloads/${n}.zip -d ${dir}/ && rm ~/Downloads/${n}.zip`;
  };
  const winCmd = (n: string, target: "openclaw" | "claude" = "openclaw") => {
    const dir = target === "claude" ? "%USERPROFILE%\\.claude\\skills" : "%USERPROFILE%\\.openclaw\\skills";
    return `mkdir ${dir} 2>nul & tar -xf %USERPROFILE%\\Downloads\\${n}.zip -C ${dir} & del %USERPROFILE%\\Downloads\\${n}.zip`;
  };

  /* ── Render ── */
  return (
    <div style={{ maxWidth: 1600, margin: "0 auto", padding: "0 24px" }}>

      {/* ═══ Header ═══ */}
      <div style={{ position: "sticky", top: 0, background: "#fafafa", zIndex: 10, paddingTop: 48, paddingBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: "#1a1a1a", margin: 0, letterSpacing: "-0.3px" }}>Skills 市场</h1>
                     <p style={{ fontSize: 13, color: "#666", margin: "4px 0 0" }}>团队共享的 AI Skills，下载后放入 Agent 的 skills 目录即可使用</p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <div style={{ textAlign: "center" }}>
              <Tooltip title="操作指南" mouseEnterDelay={TIP_DELAY}>
                <button onClick={() => setGuideOpen(true)} style={{ ...pillBtn(false), borderColor: "#d9d9d9", color: "#666" }}>
                  <QuestionCircleOutlined /> 指南
                </button>
              </Tooltip>
              <div style={{ fontSize: 10, color: "#999", marginTop: 3 }}>↑ 新手入口</div>
            </div>
            {isAdmin && (
              <Tooltip title="查看 Skills 下载量、发布者等统计数据" mouseEnterDelay={TIP_DELAY}>
                <button onClick={handleToggleStats} style={pillBtn(statsOpen)}>
                  <BarChartOutlined /> 统计
                </button>
              </Tooltip>
            )}
            <Tooltip title="上传并发布一个新的 Skill" mouseEnterDelay={TIP_DELAY}>
              <button
                onClick={() => setCreateOpen(true)}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 20px", height: 36, background: "#2c2c2c", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: "pointer" }}
              >
                <PlusOutlined /> 发布 Skill
              </button>
            </Tooltip>
          </div>
        </div>

        {/* Stats panel */}
        {isAdmin && statsOpen && stats && (
          <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #eee", padding: "16px 24px", marginBottom: 16, display: "grid", gridTemplateColumns: "100px 100px 1fr 1fr 1fr", gap: 24, alignItems: "start" }}>
            <div><div style={{ fontSize: 28, fontWeight: 700 }}>{stats.total_skills}</div><div style={{ fontSize: 11, color: "#666" }}>Skills</div></div>
            <div><div style={{ fontSize: 28, fontWeight: 700 }}>{stats.total_downloads}</div><div style={{ fontSize: 11, color: "#666" }}>下载量</div></div>
            {[{ title: "下载 Top 5", items: stats.top_downloaded.map((t) => [t.name, String(t.downloads)]) },
              { title: "发布者", items: stats.top_authors.map((a) => [a.name, `${a.count} 个`]) },
              { title: "分类", items: Object.entries(stats.category_breakdown).map(([k, v]) => [CAT_LABEL[k] || k, String(v)]) },
            ].map((sec) => (
              <div key={sec.title} style={{ borderLeft: "1px solid #f0f0f0", paddingLeft: 16 }}>
                <div style={{ fontSize: 11, color: "#666", marginBottom: 4 }}>{sec.title}</div>
                {sec.items.map(([k, v]) => (
                  <div key={k} style={{ fontSize: 12, display: "flex", justifyContent: "space-between", lineHeight: "22px" }}>
                    <span style={{ color: "#333", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{k}</span>
                    <span style={{ color: "#999", flexShrink: 0, marginLeft: 8 }}>{v}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Input ref={searchRef as any} prefix={<SearchOutlined style={{ color: "#999" }} />} placeholder='搜索名称或描述... ( 按 / 聚焦 )' allowClear style={{ width: 280 }} onChange={(e) => setSearchQ(e.target.value)} />
          <Select value={filterCat} onChange={setFilterCat} options={CATEGORIES} style={{ width: 120 }} />
          <Select value={sortBy} onChange={setSortBy} options={SORT_OPTIONS} style={{ width: 120 }} />
          <Tooltip title="只显示我收藏的 Skills" mouseEnterDelay={TIP_DELAY}>
            <button onClick={() => setFavOnly(!favOnly)} style={pillBtn(favOnly, "#2c2c2c")}>
              {favOnly ? <StarFilled /> : <StarOutlined />} 收藏
            </button>
          </Tooltip>
        </div>
      </div>

      {/* ═══ Bootstrap Banner ═══ */}
      {!bannerDismissed && (
        <div style={{ background: "#2c2c2c", borderRadius: 12, padding: "20px 24px", marginBottom: 16, display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ flex: 1, color: "#fff" }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>🦞 首次使用？让 Agent 学会操作 Skills 市场</div>
            <div style={{ fontSize: 13, opacity: 0.85 }}>
              下载引导 Skill 放入 Agent 的 skills 目录（openclaw / Claude Code 等），之后可以直接让 Agent 帮你搜索和安装 Skills
            </div>
          </div>
          <Tooltip title="下载引导 Skill 并复制安装命令" mouseEnterDelay={TIP_DELAY}>
            <button
              onClick={() => {
                const a = document.createElement("a");
                a.href = "/api/cli/skills/bootstrap/download";
                a.download = "openclaw-skills-guide.zip";
                document.body.appendChild(a); a.click(); document.body.removeChild(a);
                const cmd = isWin
                  ? `mkdir %USERPROFILE%\\.openclaw\\skills 2>nul & tar -xf %USERPROFILE%\\Downloads\\openclaw-skills-guide.zip -C %USERPROFILE%\\.openclaw\\skills & del %USERPROFILE%\\Downloads\\openclaw-skills-guide.zip`
                  : `mkdir -p ~/.openclaw/skills && unzip -o ~/Downloads/openclaw-skills-guide.zip -d ~/.openclaw/skills/ && rm ~/Downloads/openclaw-skills-guide.zip`;
                navigator.clipboard.writeText(cmd).then(() => message.success("下载成功，安装命令已复制！请打开终端粘贴执行", 4));
              }}
              style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 6, padding: "0 20px", height: 38, background: "#fff", color: "#2c2c2c", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" }}
            >
              <DownloadOutlined /> 一键下载
            </button>
          </Tooltip>
          <button
            onClick={() => { setBannerDismissed(true); localStorage.setItem("skills_banner_dismissed", "1"); }}
            style={{ flexShrink: 0, background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 16, padding: 4 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* ═══ Specification Section ═══ */}
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #eee", marginBottom: 16, overflow: "hidden" }}>
        <div
          onClick={() => { if (!specEditing) openSpec(); }}
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", cursor: specEditing ? "default" : "pointer", transition: "background 0.15s" }}
          onMouseEnter={(e) => { if (!specEditing) (e.currentTarget as HTMLElement).style.background = "#fafafa"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#fff"; }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <FileProtectOutlined style={{ fontSize: 16, color: "#1a1a1a" }} />
            <span style={{ fontSize: 15, fontWeight: 600, color: "#1a1a1a" }}>Skills 发布规范</span>
            {!specContent && specLoaded && <span style={{ fontSize: 12, color: "#999" }}>（暂未编写）</span>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {specContent && !specExpanded && (
              <span style={{ fontSize: 12, color: "#999" }}>点击展开查看</span>
            )}
            <span style={{ fontSize: 12, color: "#999", transition: "transform 0.2s", transform: specExpanded ? "rotate(180deg)" : "rotate(0)" }}>▾</span>
          </div>
        </div>
        {specExpanded && (
          <div style={{ borderTop: "1px solid #f0f0f0", padding: "16px 20px" }}>
            {specEditing ? (
              <>
                <Input.TextArea
                  rows={14}
                  value={specDraft}
                  onChange={(e) => setSpecDraft(e.target.value)}
                  placeholder={"在此编写 Skills 发布规范...\n\n例如：\n- Skill 命名规范\n- SKILL.md 内容要求\n- 文件结构标准\n- 分类选择指南"}
                  style={{ fontSize: 13, lineHeight: 1.8, fontFamily: "inherit" }}
                  autoFocus
                />
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
                  <button onClick={() => { setSpecDraft(specContent); setSpecEditing(false); }} style={{ padding: "0 16px", height: 32, background: "#fff", color: "#666", border: "1px solid #d9d9d9", borderRadius: 6, fontSize: 13, cursor: "pointer" }}>取消</button>
                  <button onClick={handleSaveSpec} disabled={specSaving} style={{ padding: "0 16px", height: 32, background: "#2c2c2c", color: "#fff", border: "none", borderRadius: 6, fontSize: 13, cursor: "pointer" }}>{specSaving ? "保存中..." : "保存"}</button>
                </div>
              </>
            ) : (
              <>
                {specContent ? (
                  <div style={{ fontSize: 14, lineHeight: 1.8, color: "#333", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{specContent}</div>
                ) : (
                  <div style={{ textAlign: "center", padding: "24px 0", color: "#999", fontSize: 13 }}>
                    {isAdmin ? "暂未编写规范，点击下方编辑按钮开始" : "管理员暂未编写规范"}
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
                  {specContent && (
                    <Tooltip title="复制规范全文" mouseEnterDelay={TIP_DELAY}>
                      <button onClick={() => navigator.clipboard.writeText(specContent).then(() => message.success("已复制规范内容"))} style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 14px", height: 32, background: "#fff", color: "#666", border: "1px solid #d9d9d9", borderRadius: 6, fontSize: 13, cursor: "pointer" }}>
                        <CopyOutlined /> 复制
                      </button>
                    </Tooltip>
                  )}
                  {isAdmin && (
                    <button onClick={() => setSpecEditing(true)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 14px", height: 32, background: "#2c2c2c", color: "#fff", border: "none", borderRadius: 6, fontSize: 13, cursor: "pointer" }}>
                      <EditOutlined /> 编辑规范
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ═══ Grid ═══ */}
      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16, paddingBottom: 40 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ background: "#fff", borderRadius: 12, border: "1px solid #eee", padding: "18px 20px 14px" }}>
              <Skeleton active title={{ width: "60%" }} paragraph={{ rows: 2, width: ["100%", "80%"] }} />
            </div>
          ))}
        </div>
      ) : skills.length === 0 ? (
        <div style={{ textAlign: "center", paddingTop: 80 }}>
          <Empty description="暂无 Skills" />
          <button
            onClick={() => setCreateOpen(true)}
            style={{ marginTop: 16, display: "inline-flex", alignItems: "center", gap: 6, padding: "0 20px", height: 36, background: "#2c2c2c", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: "pointer" }}
          >
            <PlusOutlined /> 发布第一个 Skill
          </button>
        </div>
      ) : (
        <>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
          {skills.slice(0, pageSize).map((s) => (
              <div
                key={s.name} onClick={() => openDetail(s)}
                style={{ background: "#fff", borderRadius: 12, border: "1px solid #eee", padding: "18px 20px 14px", cursor: "pointer", transition: "all 0.2s", display: "flex", flexDirection: "column" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#ccc"; (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 12px rgba(0,0,0,0.05)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#eee"; (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
              >
                {/* Name + category */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 16, fontWeight: 600, color: "#1a1a1a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
                  <Tag style={{ fontSize: 10, lineHeight: "16px", borderRadius: 4, flexShrink: 0, margin: 0 }}>{CAT_LABEL[s.category] || s.category}</Tag>
                  <Tag style={{ fontSize: 10, lineHeight: "16px", borderRadius: 4, flexShrink: 0, margin: 0 }}>{s.source === "external" ? "外部" : "内部"}</Tag>
                  <span style={{ flex: 1 }} />
                  {s.pinned && <PushpinFilled style={{ fontSize: 12, color: "#999", flexShrink: 0 }} />}
                  <span style={{ fontSize: 10, color: "#1a1a1a", flexShrink: 0 }}>🔍 点击查看详情</span>
                </div>

                {/* Description */}
                <p style={{ fontSize: 13, color: "#666", margin: 0, lineHeight: 1.6, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {s.description || "暂无描述"}
                </p>

                <div style={{ flex: 1 }} />

                {/* Footer */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 12, color: "#999" }}>{s.author_name || "system"} · {s.downloads} 次下载</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 2, fontSize: 12 }} onClick={(e) => e.stopPropagation()}>
                      <Tooltip title={s.my_vote === "up" ? "取消推荐" : "推荐"} mouseEnterDelay={TIP_DELAY}>
                        <button onClick={(e) => handleVote(s, "up", e)} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: s.my_vote === "up" ? "#333" : "#999", fontSize: 13, display: "flex", alignItems: "center" }}>
                          {s.my_vote === "up" ? <LikeFilled /> : <LikeOutlined />}
                        </button>
                      </Tooltip>
                      {(s.ups > 0 || s.downs > 0) && <span style={{ color: "#999", fontSize: 11 }}>{s.ups}</span>}
                      <Tooltip title={s.my_vote === "down" ? "取消不推荐" : "不推荐"} mouseEnterDelay={TIP_DELAY}>
                        <button onClick={(e) => handleVote(s, "down", e)} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: s.my_vote === "down" ? "#333" : "#999", fontSize: 13, display: "flex", alignItems: "center" }}>
                          {s.my_vote === "down" ? <DislikeFilled /> : <DislikeOutlined />}
                        </button>
                      </Tooltip>
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 4 }} onClick={(e) => e.stopPropagation()}>
                    <Tooltip title={s.has_update ? "此 Skill 有新版本，重新下载以更新" : s.favorited ? "取消收藏" : "收藏此 Skill"} mouseEnterDelay={TIP_DELAY}>
                      <button onClick={(e) => handleFav(s, e)} style={{ ...iconBtn, color: s.favorited ? "#333" : "#d9d9d9", borderColor: s.favorited ? "#d0d0d0" : "#f0f0f0", position: "relative" }}>
                        {s.favorited ? <StarFilled /> : <StarOutlined />}
                        {s.has_update && <span style={{ position: "absolute", top: -2, right: -2, width: 7, height: 7, borderRadius: "50%", background: "#ff4d4f", border: "1px solid #fff" }} />}
                      </button>
                    </Tooltip>
                    {canEdit(s) && (
                      <Tooltip title="删除此 Skill" mouseEnterDelay={TIP_DELAY}>
                        <button onClick={(e) => handleDelete(s, e)} style={{ ...iconBtn, color: "#999", borderColor: "#e5e5e5" }}><DeleteOutlined /></button>
                      </Tooltip>
                    )}
                    {isAdmin && (
                      <Tooltip title={s.pinned ? "取消推荐" : "设为推荐"} mouseEnterDelay={TIP_DELAY}>
                        <button onClick={(e) => handlePin(s, e)} style={{ ...iconBtn, color: s.pinned ? "#333" : "#d9d9d9", borderColor: s.pinned ? "#d0d0d0" : "#f0f0f0" }}>
                          {s.pinned ? <PushpinFilled /> : <PushpinOutlined />}
                        </button>
                      </Tooltip>
                    )}
                    <Tooltip title="下载 Skill 并复制安装命令，下载后打开终端粘贴即可安装" mouseEnterDelay={TIP_DELAY}>
                      <button onClick={(e) => { handleDownload(s.name, e); const cmd = isWin ? winCmd(s.name, cmdTarget) : macCmd(s.name, cmdTarget); navigator.clipboard.writeText(cmd).then(() => message.success("下载成功，安装命令已复制！请打开终端粘贴执行", 4)); }} style={{ ...iconBtn, background: "#2c2c2c", color: "#fff", borderColor: "#2c2c2c" }}>
                        <DownloadOutlined />
                      </button>
                    </Tooltip>
                  </div>
                </div>
              </div>
          ))}
        </div>
        {skills.length > pageSize && (
          <div style={{ textAlign: "center", padding: "24px 0 0" }}>
            <button
              onClick={() => setPageSize((p) => p + 12)}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "0 24px", height: 36, background: "#fff", color: "#666", border: "1px solid #d9d9d9", borderRadius: 8, fontSize: 13, cursor: "pointer" }}
            >
              加载更多（还有 {skills.length - pageSize} 个）
            </button>
          </div>
        )}

        {/* External Skills */}
        <div style={{ textAlign: "center", padding: "80px 0 48px" }}>
          <span style={{ fontSize: 13, color: "#999" }}>找不到想要的 Skill？去外部广场看看</span>
          <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 12 }}>
            {[
              { name: "Smithery", url: "https://smithery.ai", desc: "MCP 工具市场" },
              { name: "GitHub MCP", url: "https://github.com/punkpeye/awesome-mcp-servers", desc: "开源工具合集" },
              { name: "Cursor Directory", url: "https://cursor.directory", desc: "AI Rules 社区" },
            ].map((site) => (
              <a
                key={site.name}
                href={site.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 16px", background: "#fafafa", border: "1px solid #eee", borderRadius: 8, fontSize: 12, color: "#666", textDecoration: "none", transition: "all 0.15s" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#ccc"; (e.currentTarget as HTMLElement).style.background = "#f5f5f5"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#eee"; (e.currentTarget as HTMLElement).style.background = "#fafafa"; }}
              >
                <span style={{ fontWeight: 500, color: "#333" }}>{site.name}</span>
                <span style={{ color: "#999" }}>{site.desc}</span>
                <span style={{ color: "#999", fontSize: 10 }}>↗</span>
              </a>
            ))}
          </div>
        </div>
        </>
      )}

      {/* ═══ Detail Drawer ═══ */}
      <Drawer title={null} open={detailOpen} onClose={() => { setDetailOpen(false); closePv(); }} width={620} styles={{ body: { padding: 0 } }}>
        {detailSkill && (() => {
          const sf = sortFiles(detailSkill.files);
          const cmd = (cmdOS === "mac" ? macCmd : winCmd)(detailSkill.name, cmdTarget);
          return (
            <div style={{ padding: "28px 28px 40px" }}>
              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                <h2 style={{ fontSize: 22, fontWeight: 700, color: "#1a1a1a", margin: 0 }}>{detailSkill.name}</h2>
                <Tag>{CAT_LABEL[detailSkill.category] || detailSkill.category}</Tag>
                <Tag>{detailSkill.source === "external" ? "外部" : "内部"}</Tag>
                {detailSkill.version && <Tag style={{ fontSize: 11 }}>v{detailSkill.version}</Tag>}
                {detailSkill.pinned && <Tag>推荐</Tag>}
              </div>
              <p style={{ fontSize: 14, color: "#666", margin: "0 0 16px", lineHeight: 1.6 }}>{detailSkill.description || "暂无描述"}</p>

              {/* Meta row */}
              <div style={{ display: "flex", gap: 24, fontSize: 13, color: "#999", paddingBottom: 16, borderBottom: "1px solid #f0f0f0", marginBottom: 20 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}><UserOutlined /> {detailSkill.author_name || "system"}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}><DownloadOutlined /> {detailSkill.downloads} 次下载</span>
                {detailSkill.updated_at && <span>更新于 {new Date(detailSkill.updated_at).toLocaleDateString("zh-CN")}</span>}
              </div>

              {/* Actions — two rows */}
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <Tooltip title="下载 Skill 压缩包到本地" mouseEnterDelay={TIP_DELAY}>
                  <button onClick={(e) => handleDownload(detailSkill.name, e)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 20px", height: 36, background: "#2c2c2c", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: "pointer" }}>
                    <DownloadOutlined /> 下载 Skill
                  </button>
                </Tooltip>
                {canEdit(detailSkill) && (
                  <>
                    <Tooltip title="修改描述、分类或替换文件包" mouseEnterDelay={TIP_DELAY}>
                      <button onClick={(e) => { setDetailOpen(false); openEditInfo(detailSkill, e); }} style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 14px", height: 36, background: "#fff", color: "#333", border: "1px solid #ddd", borderRadius: 8, fontSize: 13, cursor: "pointer" }}>
                        <EditOutlined /> 编辑信息
                      </button>
                    </Tooltip>
                    <Tooltip title="修改版本号和更新日志" mouseEnterDelay={TIP_DELAY}>
                      <button onClick={(e) => { setDetailOpen(false); openEditChangelog(detailSkill, e); }} style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 14px", height: 36, background: "#fff", color: "#333", border: "1px solid #ddd", borderRadius: 8, fontSize: 13, cursor: "pointer" }}>
                        <HistoryOutlined /> 更新日志
                      </button>
                    </Tooltip>
                  </>
                )}
              </div>

              {/* Changelog badge */}
              {detailSkill.changelog && (
                <div style={{ background: "#f9f9f9", border: "1px solid #eee", borderRadius: 8, padding: "10px 14px", marginBottom: 20, fontSize: 13, display: "flex", alignItems: "baseline", gap: 8 }}>
                  <Tag style={{ flexShrink: 0, margin: 0 }}>v{detailSkill.version}</Tag>
                  <span style={{ color: "#555" }}>{detailSkill.changelog}</span>
                </div>
              )}

              {/* Install command */}
              <div style={{ background: "#141414", borderRadius: 10, padding: "14px 16px", marginBottom: 24 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <span style={{ fontSize: 12, color: "#666", fontWeight: 500 }}>安装命令</span>
                  <div style={{ display: "flex", gap: 4 }}>
                    {(["openclaw", "claude"] as const).map((t) => (
                      <Tooltip key={t} title={t === "openclaw" ? "安装到 openclaw" : "安装到 Claude Code"} mouseEnterDelay={TIP_DELAY}>
                        <button onClick={() => setCmdTarget(t)} style={pillBtn(cmdTarget === t, "#444")}>
                          {t === "openclaw" ? "openclaw" : "Claude Code"}
                        </button>
                      </Tooltip>
                    ))}
                    <span style={{ width: 1, background: "#333", margin: "0 4px" }} />
                    {(["mac", "win"] as const).map((os) => (
                      <Tooltip key={os} title={os === "mac" ? "显示 macOS 安装命令" : "显示 Windows 安装命令"} mouseEnterDelay={TIP_DELAY}>
                        <button onClick={() => setCmdOS(os)} style={pillBtn(cmdOS === os, "#444")}>
                          {os === "mac" ? <><AppleOutlined /> Mac</> : <><WindowsOutlined /> Win</>}
                        </button>
                      </Tooltip>
                    ))}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: "#666", marginBottom: 8 }}>如下载路径非默认 Downloads，请替换命令中的路径</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <code style={{ flex: 1, fontSize: 12, color: "#a3e635", fontFamily: "'SF Mono','Fira Code',monospace", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cmd}</code>
                  <Tooltip title="复制安装命令到剪贴板" mouseEnterDelay={TIP_DELAY}>
                    <button onClick={() => navigator.clipboard.writeText(cmd).then(() => message.success("已复制"))} style={{ flexShrink: 0, background: "#2a2a2a", border: "1px solid #3a3a3a", borderRadius: 6, padding: "4px 12px", cursor: "pointer", color: "#999", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
                      <CopyOutlined /> 复制
                    </button>
                  </Tooltip>
                </div>
              </div>

              {/* File list */}
              {sf.length > 0 && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "#1a1a1a", marginBottom: 10 }}>
                    <FileZipOutlined /> {sf.length} 个文件
                    <span style={{ fontSize: 12, fontWeight: 400, color: "#999" }}>- 点击预览</span>
                  </div>
                  <div style={{ borderRadius: 10, border: "1px solid #f0f0f0", overflow: "hidden" }}>
                    {sf.map((f, idx) => {
                      const active = pvName === f.name;
                      return (
                        <div key={f.name}>
                          <Tooltip title={active ? "点击收起预览" : `点击预览 ${f.name}`} mouseEnterDelay={TIP_DELAY}>
                          <div
                            onClick={() => active ? closePv() : handlePreviewFile(detailSkill.name, f.name)}
                            style={{
                              display: "flex", alignItems: "center", justifyContent: "space-between",
                              padding: "10px 16px", fontSize: 13, cursor: "pointer",
                              background: active ? "#e6f4ff" : "#fafafa",
                              borderBottom: active ? "none" : idx < sf.length - 1 ? "1px solid #f0f0f0" : "none",
                              transition: "background 0.15s",
                            }}
                            onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = "#f0f0f0"; }}
                            onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = "#fafafa"; }}
                          >
                            <span style={{ display: "flex", alignItems: "center", gap: 6, color: active ? "#1677ff" : "#333", fontWeight: active ? 500 : 400 }}>
                              <FileTextOutlined style={{ color: active ? "#1677ff" : "#999" }} />
                              {f.name}
                            </span>
                            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ color: "#999", fontSize: 12 }}>{fmtSize(f.size)}</span>
                              <EyeOutlined style={{ color: active ? "#1677ff" : "#ddd", fontSize: 12 }} />
                            </span>
                          </div>
                          </Tooltip>
                          {active && (
                            <div ref={(el) => { if (el) setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50); }} style={{ padding: "12px 16px", background: "#fff", borderBottom: idx < sf.length - 1 ? "1px solid #f0f0f0" : "none" }}>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                                <span style={{ fontSize: 12, color: "#1677ff", fontWeight: 500, display: "flex", alignItems: "center", gap: 4 }}><EyeOutlined /> {f.name}</span>
                                <Tooltip title="关闭文件预览" mouseEnterDelay={TIP_DELAY}>
                                  <button onClick={(e) => { e.stopPropagation(); closePv(); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#999", display: "flex", alignItems: "center", gap: 4 }}><ArrowLeftOutlined /> 关闭</button>
                                </Tooltip>
                              </div>
                              {pvLoading ? (
                                <div style={{ textAlign: "center", padding: 20 }}><Spin size="small" /></div>
                              ) : f.name.endsWith(".md") ? (
                                <div className="markdown-body" style={{ fontSize: 13, lineHeight: 1.7, color: "#333", maxHeight: 400, overflow: "auto" }}><ReactMarkdown>{pvContent}</ReactMarkdown></div>
                              ) : (
                                <pre style={{ margin: 0, padding: 12, background: "#f9f9f9", border: "1px solid #eee", borderRadius: 6, fontSize: 12, lineHeight: 1.6, color: "#333", overflow: "auto", maxHeight: 400, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{pvContent}</pre>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Comments */}
              <div style={{ marginTop: 24 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "#1a1a1a", marginBottom: 12 }}>
                  <MessageOutlined /> 评论 {comments.length > 0 && <span style={{ fontWeight: 400, color: "#999" }}>({comments.length})</span>}
                </div>
                {/* Input */}
                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                  <Input
                    placeholder="写一条简评（200 字以内）"
                    maxLength={200}
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onPressEnter={handleAddComment}
                    style={{ flex: 1 }}
                  />
                  <Tooltip title="发送评论" mouseEnterDelay={TIP_DELAY}>
                    <button
                      onClick={handleAddComment}
                      disabled={commentLoading || !commentText.trim()}
                      style={{ display: "flex", alignItems: "center", gap: 4, padding: "0 14px", height: 32, background: commentText.trim() ? "#2c2c2c" : "#f0f0f0", color: commentText.trim() ? "#fff" : "#999", border: "none", borderRadius: 6, fontSize: 13, cursor: commentText.trim() ? "pointer" : "not-allowed" }}
                    >
                      <SendOutlined />
                    </button>
                  </Tooltip>
                </div>
                {/* List */}
                {comments.length === 0 ? (
                  <div style={{ fontSize: 12, color: "#999", textAlign: "center", padding: "8px 0" }}>暂无评论</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {comments.map((c, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13 }}>
                        <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#f0f0f0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 11, color: "#999", fontWeight: 500 }}>
                          {(c.user_name || "?")[0].toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontWeight: 500, color: "#333" }}>{c.user_name}</span>
                            <span style={{ fontSize: 11, color: "#999" }}>{new Date(c.created_at).toLocaleDateString("zh-CN")}</span>
                            {(c.user_id === user?.id || isAdmin) && (
                              <Tooltip title="删除此评论" mouseEnterDelay={TIP_DELAY}>
                                <button onClick={() => handleDeleteComment(i)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "#999", padding: 0 }}>
                                  <DeleteOutlined />
                                </button>
                              </Tooltip>
                            )}
                          </div>
                          <div style={{ color: "#666", lineHeight: 1.6, wordBreak: "break-word" }}>{c.content}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </Drawer>

      {/* ═══ Create Modal ═══ */}
      <Modal title="发布新 Skill" open={createOpen} onCancel={() => { setCreateOpen(false); setNewFile(null); }} onOk={handleCreate} okText="发布" cancelText="取消" confirmLoading={createLoading} width={560}>
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={label}>名称 <span style={{ color: "#ff4d4f" }}>*</span></label>
            <Input placeholder="英文小写，如 code-reviewer" value={newName} onChange={(e) => setNewName(e.target.value)} />
          </div>
          <div>
            <label style={label}>描述</label>
            <Input placeholder="一句话描述功能" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}><label style={label}>分类</label><Select value={newCat} onChange={setNewCat} options={CATEGORIES.filter((c) => c.value !== "")} style={{ width: "100%" }} /></div>
            <div style={{ flex: 1 }}><label style={label}>来源</label><Select value={newSource} onChange={setNewSource} options={[{ value: "internal", label: "内部开发" }, { value: "external", label: "外部下载" }]} style={{ width: "100%" }} /></div>
            <div style={{ flex: 1 }}><label style={label}>版本号</label><Input placeholder="1.0.0" value={newVersion} onChange={(e) => setNewVersion(e.target.value)} /></div>
          </div>
          <div>
            <label style={label}>更新日志</label>
            <Input placeholder="首次发布" value={newChangelog} onChange={(e) => setNewChangelog(e.target.value)} />
          </div>
          <div>
            <label style={label}>文件包 <span style={{ color: "#ff4d4f" }}>*</span></label>
            <Upload.Dragger accept=".zip" maxCount={1} beforeUpload={(file) => { setNewFile(file); return false; }} onRemove={() => setNewFile(null)} fileList={newFile ? [{ uid: "-1", name: newFile.name, status: "done" as const, size: newFile.size }] : []}>
              <p style={{ color: "#999", marginBottom: 4 }}><InboxOutlined style={{ fontSize: 28 }} /></p>
              <p style={{ fontSize: 13, color: "#333" }}>拖拽或点击上传 .zip</p>
              <p style={{ fontSize: 11, color: "#999" }}>需包含 SKILL.md 主文件</p>
            </Upload.Dragger>
          </div>
        </div>
      </Modal>

      {/* ═══ Edit Info Modal ═══ */}
      <Modal title={`编辑信息：${detailSkill?.name || ""}`} open={editOpen} onCancel={() => { setEditOpen(false); setEditFile(null); }} onOk={handleEditInfo} okText="保存" cancelText="取消" confirmLoading={editLoading} width={560}>
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 16 }}>
          <div><label style={label}>描述</label><Input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} /></div>
          <div><label style={label}>分类</label><Select value={editCat} onChange={setEditCat} options={CATEGORIES.filter((c) => c.value !== "")} style={{ width: 200 }} /></div>
          <div>
            <label style={label}>替换文件包（可选）</label>
            <Upload.Dragger accept=".zip" maxCount={1} beforeUpload={(file) => { setEditFile(file); return false; }} onRemove={() => setEditFile(null)} fileList={editFile ? [{ uid: "-1", name: editFile.name, status: "done" as const, size: editFile.size }] : []}>
              <p style={{ color: "#999", marginBottom: 4 }}><InboxOutlined style={{ fontSize: 28 }} /></p>
              <p style={{ fontSize: 13, color: "#333" }}>拖拽或点击上传新的 .zip</p>
            </Upload.Dragger>
          </div>
        </div>
      </Modal>

      {/* ═══ Edit Changelog Modal ═══ */}
      <Modal title={`更新日志：${detailSkill?.name || ""}`} open={changelogOpen} onCancel={() => setChangelogOpen(false)} onOk={handleEditChangelog} okText="保存" cancelText="取消" confirmLoading={changelogLoading} width={480}>
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 16 }}>
          <div><label style={label}>版本号</label><Input placeholder="1.0.1" value={editVersion} onChange={(e) => setEditVersion(e.target.value)} /></div>
          <div><label style={label}>更新内容</label><Input.TextArea rows={3} placeholder="描述本次更新的内容..." value={editChangelog} onChange={(e) => setEditChangelog(e.target.value)} /></div>
        </div>
      </Modal>

      {/* ═══ Guide Modal ═══ */}
      <Modal title="Skills 市场操作指南" open={guideOpen} onCancel={() => setGuideOpen(false)} footer={null} width={560}>
        <div style={{ marginTop: 12, fontSize: 14, lineHeight: 1.8, color: "#333" }}>
          {/* Bootstrap */}
          <div style={{ background: "#2c2c2c", borderRadius: 10, padding: "16px 20px", marginBottom: 20, display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ flex: 1, color: "#fff" }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>🦞 让 Agent 学会操作 Skills 市场</div>
              <div style={{ fontSize: 12, opacity: 0.85 }}>下载此 Skill 放入 Agent 的 skills 目录（openclaw / Claude Code 等），即可让 Agent 搜索和安装 Skills</div>
            </div>
            <button
              onClick={() => {
                const a = document.createElement("a");
                a.href = "/api/cli/skills/bootstrap/download";
                a.download = "openclaw-skills-guide.zip";
                document.body.appendChild(a); a.click(); document.body.removeChild(a);
                const cmd = isWin
                  ? `mkdir %USERPROFILE%\\.openclaw\\skills 2>nul & tar -xf %USERPROFILE%\\Downloads\\openclaw-skills-guide.zip -C %USERPROFILE%\\.openclaw\\skills & del %USERPROFILE%\\Downloads\\openclaw-skills-guide.zip`
                  : `mkdir -p ~/.openclaw/skills && unzip -o ~/Downloads/openclaw-skills-guide.zip -d ~/.openclaw/skills/ && rm ~/Downloads/openclaw-skills-guide.zip`;
                navigator.clipboard.writeText(cmd).then(() => message.success("下载成功，安装命令已复制！请打开终端粘贴执行", 4));
              }}
              style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 6, padding: "0 16px", height: 34, background: "#fff", color: "#2c2c2c", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
            >
              <DownloadOutlined /> 一键下载
            </button>
          </div>

          <h3 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 8px" }}>一、如何安装 Skill</h3>
          <ol style={{ paddingLeft: 20, margin: "0 0 20px" }}>
            <li>点击卡片右下角的 <DownloadOutlined style={{ color: "#1a1a1a" }} /> <strong>下载按钮</strong></li>
            <li>系统会自动下载 .zip 文件，同时将安装命令复制到你的剪贴板</li>
            <li>
              <strong>打开终端</strong>（不知道终端是什么？往下看）
            </li>
            <li>在终端中按 <code style={{ background: "#f5f5f5", padding: "1px 6px", borderRadius: 4, fontSize: 13 }}>{isWin ? "Ctrl + V" : "Cmd + V"}</code> 粘贴，然后按回车执行</li>
            <li>安装完成！Skill 会被放入对应 agent 的 skills 目录：
              <ul style={{ paddingLeft: 20, margin: "4px 0", fontSize: 13, color: "#666" }}>
                <li>openclaw → <code style={{ background: "#f5f5f5", padding: "1px 6px", borderRadius: 4, fontSize: 12 }}>~/.openclaw/skills/</code></li>
                <li>Claude Code → <code style={{ background: "#f5f5f5", padding: "1px 6px", borderRadius: 4, fontSize: 12 }}>~/.claude/skills/</code></li>
              </ul>
            </li>
          </ol>

          <h3 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 8px" }}>二、如何打开终端</h3>
          <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
            <div style={{ flex: 1, background: "#f9f9f9", borderRadius: 8, padding: "12px 16px" }}>
              <div style={{ fontWeight: 600, marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}><AppleOutlined /> Mac</div>
              <div style={{ fontSize: 13, color: "#666" }}>
                按 <code style={{ background: "#eee", padding: "1px 4px", borderRadius: 3 }}>Cmd + 空格</code> 打开聚焦搜索，输入 <strong>Terminal</strong> 或 <strong>终端</strong>，回车打开
              </div>
            </div>
            <div style={{ flex: 1, background: "#f9f9f9", borderRadius: 8, padding: "12px 16px" }}>
              <div style={{ fontWeight: 600, marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}><WindowsOutlined /> Windows</div>
              <div style={{ fontSize: 13, color: "#666" }}>
                按 <code style={{ background: "#eee", padding: "1px 4px", borderRadius: 3 }}>Win + R</code>，输入 <strong>cmd</strong>，回车打开命令提示符
              </div>
            </div>
          </div>

          <h3 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 8px" }}>三、支持哪些 Agent</h3>
          <p style={{ fontSize: 13, color: "#666", margin: "0 0 8px" }}>
            Skills 本质是一组规则文件（SKILL.md 为主），可被各种 AI Agent / 编码助手读取和使用。目前支持：
          </p>
          <ul style={{ paddingLeft: 20, margin: "0 0 20px", fontSize: 13, color: "#666" }}>
            <li><strong>openclaw（龙虾）</strong> — 安装到 <code style={{ background: "#f5f5f5", padding: "1px 4px", borderRadius: 3, fontSize: 12 }}>~/.openclaw/skills/</code></li>
            <li><strong>Claude Code</strong> — 安装到 <code style={{ background: "#f5f5f5", padding: "1px 4px", borderRadius: 3, fontSize: 12 }}>~/.claude/skills/</code></li>
            <li><strong>其他 Agent</strong> — 只要 Agent 支持读取 skills / rules 目录，均可手动将下载的 Skill 放入其对应目录使用（如 Cursor、Windsurf 等）</li>
          </ul>
          <div style={{ background: "#f9f9f9", border: "1px solid #eee", borderRadius: 8, padding: "10px 14px", marginBottom: 20, fontSize: 13, color: "#666" }}>
            💡 下载时可在详情页的安装命令区域切换目标 Agent（openclaw / Claude Code），系统会自动生成对应的安装命令。
          </div>

          <h3 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 8px" }}>四、其他功能</h3>
          <ul style={{ paddingLeft: 20, margin: "0 0 20px", fontSize: 13, color: "#666" }}>
            <li><StarOutlined /> 收藏 — 把常用的 Skill 加入收藏夹，方便快速找到</li>
            <li><EyeOutlined /> 预览 — 在详情页点击文件名可直接预览内容，无需下载</li>
            <li><PushpinOutlined /> 推荐 — 管理员可将优质 Skill 置顶推荐给所有人</li>
          </ul>

          <h3 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 8px" }}>五、CLI 接口（开发者）</h3>
          <p style={{ fontSize: 13, color: "#666", margin: "0 0 8px" }}>
            openclaw / Claude Code 可通过以下 API 直接管理 Skills，无需打开浏览器：
          </p>
          <div style={{ background: "#141414", borderRadius: 8, padding: "12px 16px", marginBottom: 20, fontSize: 12, fontFamily: "'SF Mono','Fira Code',monospace", color: "#a3e635", lineHeight: 2, overflowX: "auto" }}>
            <div><span style={{ color: "#666" }}># 列出所有 Skills</span></div>
            <div>curl {window.location.origin}/api/cli/skills</div>
            <div style={{ marginTop: 4 }}><span style={{ color: "#666" }}># 搜索</span></div>
            <div>curl {window.location.origin}/api/cli/skills?q=keyword</div>
            <div style={{ marginTop: 4 }}><span style={{ color: "#666" }}># 查看详情</span></div>
            <div>curl {window.location.origin}/api/cli/skills/skill-name</div>
            <div style={{ marginTop: 4 }}><span style={{ color: "#666" }}># 下载安装</span></div>
            <div>curl -o skill.zip {window.location.origin}/api/cli/skills/skill-name/install</div>
          </div>

          <div style={{ marginTop: 20, padding: "10px 14px", background: "#f9f9f9", border: "1px solid #eee", borderRadius: 8, fontSize: 13, color: "#666" }}>
            💡 如果你的浏览器下载路径不是默认的 Downloads 文件夹，请在粘贴命令后手动修改路径再执行。
          </div>
        </div>
      </Modal>
    </div>
  );
}
