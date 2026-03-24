# -*- coding: utf-8 -*-
import os
import sys
import pandas as pd
import requests
import json
import concurrent.futures
import csv
import threading
import re
import time
import traceback
from typing import List, Any, Dict

# ==============================================================================
# --- 1. 配置中心 ---
# ==============================================================================
class Config:
    # --- Dify API 凭证与地址 ---
    DIFY_API_KEY: str = "app-mxQJe0WxpwnllCAYuH1g4zYg"
    DIFY_API_URL: str = "http://10.102.104.18:8185/v1/workflows/run"

    # --- 文件路径设置 ---
    RECORD_CSV_PATH: str = "record_news_progress.csv"
    FINAL_POSITIVE_PATH: str = "新闻评估_正向反馈结果.csv"
    FINAL_NEGATIVE_PATH: str = "新闻评估_负向反馈结果.csv"

    # --- 性能参数 ---
    MAX_CONCURRENT_REQUESTS: int = 15 # 并发数
    REQUEST_TIMEOUT: int = 3600
    MAX_RETRIES: int = 3
    RETRY_BASE_DELAY: float = 1.0
    API_USER_IDENTITY: str = "news_test"

# ==============================================================================
# --- 2. 预处理逻辑 (融合原始脚本的变量检测) ---
# ==============================================================================
def preprocess_step():
    # Dify 输入映射
    input_map = {
        "assistant_query": "新闻推送问询示意", "tool_output": "答复结果-新闻简报数据",
        "positive_query": "正向反馈query", "negative_query": "负向反馈query",
        "session_id": "session_id", "negative_answer": "负向反馈answer",
        "positive_answer": "正向反馈answer", "persona": "persona_internal"
    }
    # Dify 输出更名
    output_rename_map = {
        "persona_reason": "人设信息", "cohesion_reason": "口语化",
        "accuracy_reason": "准确性", "positive_label": "pos_label_internal",
        "negative_label": "neg_label_internal"
    }

    print("\n" + "="*60)
    print(" 状态检测中...")

    # 1. 尝试加载现有进度
    if os.path.exists(Config.RECORD_CSV_PATH):
        try:
            df = pd.read_csv(Config.RECORD_CSV_PATH, keep_default_na=False, encoding='utf-8-sig')
            
            # 【核心逻辑】：标准化 DONE 列的判断 (确保识别字符串格式的 FALSE)
            # 只有明确为 "TRUE" (不区分大小写) 的才视为完成
            df['DONE'] = df['DONE'].astype(str).str.strip().str.upper() == 'TRUE'
            
            incomplete_count = (df['DONE'] == False).sum()
            if incomplete_count > 0:
                print(f"✅ 发现断点！剩余 {incomplete_count} 条数据待处理，自动开始批跑...")
                return df, input_map, output_rename_map
            else:
                print("💡 当前进度文件已全部完成 (DONE 均为 TRUE)。")
        except Exception as e:
            print(f"⚠️ 进度文件读取失败: {e}")

    # 2. 初始化新任务
    print(" 步骤 1/2: 初始化新任务")
    print("="*60)
    while True:
        raw_path = input("\n>>> 请拖入【原始Excel/CSV数据】并按回车: ").strip()
        raw_path = raw_path.replace('"', '').replace("'", "")
        if os.path.exists(raw_path): break
        print(f"❌ 错误：找不到文件，请重新拖入！")

    persona_text = input(">>> 请输入当前数据对应的 persona 并按回车: ").strip()

    try:
        if raw_path.lower().endswith(('.xlsx', '.xls')):
            df = pd.read_excel(raw_path)
        else:
            df = pd.read_csv(raw_path, keep_default_na=False, encoding='utf-8-sig')

        df['persona_internal'] = persona_text
        df['DONE'] = False # 初始化全部为 False
        
        # 确保列名存在
        for col in input_map.values():
            if col not in df.columns: df[col] = ""

        df.to_csv(Config.RECORD_CSV_PATH, index=False, encoding='utf-8-sig')
        print(f"✅ 初始化完成。")
        return df, input_map, output_rename_map
    except Exception as e:
        print(f"\n❌ 初始化失败: {e}"); traceback.print_exc()
        return None, None, None

# ==============================================================================
# --- 3. Dify 执行器 (融合原始脚本的并发与保存逻辑) ---
# ==============================================================================
class WorkflowRunner:
    def __init__(self, config: Config, df: pd.DataFrame, in_map: dict, out_map: dict):
        self.config = config
        self.df = df
        self.in_map = in_map
        self.out_map = out_map
        self.df_lock = threading.Lock()
        
        from requests.adapters import HTTPAdapter
        self.session = requests.Session()
        self.session.mount("http://", HTTPAdapter(pool_connections=20, pool_maxsize=20))

    def _call_dify_workflow(self, row_data: Dict[str, Any]) -> Dict[str, Any]:
        # 映射输入变量
        dify_inputs = {k: str(row_data.get(v, "")) for k, v in self.in_map.items()}
        headers = {'Authorization': f'Bearer {self.config.DIFY_API_KEY}', 'Content-Type': 'application/json'}
        payload = {"inputs": dify_inputs, "response_mode": "blocking", "user": self.config.API_USER_IDENTITY}

        for attempt in range(1, self.config.MAX_RETRIES + 1):
            try:
                resp = self.session.post(self.config.DIFY_API_URL, headers=headers, json=payload, timeout=self.config.REQUEST_TIMEOUT)
                if resp.status_code == 200:
                    res_json = resp.json()
                    # 自动提取 outputs (兼容不同返回结构)
                    data = res_json.get("data", res_json)
                    outputs = data.get("outputs", data)
                    
                    processed = {}
                    exclude = ["status", "workflow_run_id", "task_id", "elapsed_time", "total_tokens", "created_at", "finished_at"]
                    for k, v in outputs.items():
                        if k in exclude: continue
                        final_key = self.out_map.get(k, k)
                        # 序列化复杂对象
                        processed[final_key] = json.dumps(v, ensure_ascii=False) if isinstance(v, (dict, list)) else str(v)
                    return processed
            except:
                pass
            time.sleep(self.config.RETRY_BASE_DELAY * attempt)
        return {}

    def run(self):
        print("\n" + "="*60)
        print(" 步骤 2/2: 批跑执行 (直至所有行 DONE=TRUE)")
        print("="*60)

        # 循环直到没有待处理行 (模仿原始脚本的 re-run 逻辑)
        while True:
            # 重新扫描待跑索引
            incomplete_mask = (self.df['DONE'] == False)
            tasks_idx = self.df.index[incomplete_mask].tolist()
            
            if not tasks_idx:
                print("\n✅ 所有数据已成功标记为 TRUE。")
                break

            total = len(self.df)
            print(f"🚀 正在处理剩余的 {len(tasks_idx)} 条数据...")

            with concurrent.futures.ThreadPoolExecutor(max_workers=self.config.MAX_CONCURRENT_REQUESTS) as executor:
                future_to_idx = {executor.submit(self._call_dify_workflow, self.df.loc[i].to_dict()): i for i in tasks_idx}
                
                for future in concurrent.futures.as_completed(future_to_idx):
                    idx = future_to_idx[future]
                    try:
                        res = future.result()
                        if res: # 只有返回了有效数据才标记 DONE
                            with self.df_lock:
                                for k, v in res.items():
                                    if k not in self.df.columns: self.df[k] = pd.NA
                                    self.df.loc[idx, k] = v
                                self.df.loc[idx, 'DONE'] = True
                                # 实时持久化保存 (对应原始脚本的 write_counter 逻辑)
                                self.df.to_csv(Config.RECORD_CSV_PATH, index=False, encoding='utf-8-sig')
                                print(f" 进度: {int(self.df['DONE'].sum())}/{total}".ljust(35), end="\r")
                    except Exception as e:
                        print(f"\n[警告] 索引 {idx} 运行出错: {e}")

            # 再次检查，如果本轮运行后仍有 FALSE，打印提示并准备退出或进入下一轮
            remaining = (self.df['DONE'] == False).sum()
            if remaining > 0:
                print(f"\n⚠️ 本轮结束仍有 {remaining} 条失败。尝试重新扫描运行...")
                time.sleep(2) # 稍微停顿
            else:
                break

        # --- 拆分导出结果表 ---
        print(f"\n\n正在导出最终报表...")
        
        # 结果表导出只包含 DONE 为 TRUE 的行
        final_df = self.df[self.df['DONE'] == True].copy()
        
        # 正向表
        pos_df = final_df[final_df["正向反馈query"].fillna("").str.strip() != ""].copy()
        if not pos_df.empty:
            pos_cols = ["新闻推送问询示意", "答复结果-新闻简报数据", "正向反馈query", "正向反馈answer", "人设信息", "口语化", "准确性", "pos_label_internal"]
            pos_df = pos_df[[c for c in pos_cols if c in pos_df.columns]]
            pos_df.rename(columns={"pos_label_internal": "评分"}, inplace=True)
            pos_df.to_csv(Config.FINAL_POSITIVE_PATH, index=False, encoding='utf-8-sig')
            print(f"✅ 已生成正向结果表: {Config.FINAL_POSITIVE_PATH}")

        # 负向表
        neg_df = final_df[final_df["负向反馈query"].fillna("").str.strip() != ""].copy()
        if not neg_df.empty:
            neg_cols = ["新闻推送问询示意", "答复结果-新闻简报数据", "负向反馈query", "负向反馈answer", "neg_label_internal"]
            neg_df = neg_df[[c for c in neg_cols if c in neg_df.columns]]
            neg_df.rename(columns={"neg_label_internal": "评分"}, inplace=True)
            neg_df.to_csv(Config.FINAL_NEGATIVE_PATH, index=False, encoding='utf-8-sig')
            print(f"✅ 已生成负向结果表: {Config.FINAL_NEGATIVE_PATH}")

        print(f"\n🎉 运行结束！")

# ==============================================================================
# --- 4. 程序入口 ---
# ==============================================================================
if __name__ == "__main__":
    df_data, in_mapping, out_mapping = preprocess_step()
    if df_data is not None:
        runner = WorkflowRunner(Config(), df_data, in_mapping, out_mapping)
        runner.run()