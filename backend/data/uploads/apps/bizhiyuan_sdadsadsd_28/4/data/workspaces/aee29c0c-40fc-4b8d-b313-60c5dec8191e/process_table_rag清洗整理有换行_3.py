#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import pandas as pd
import json
import argparse
import os
import sys
import re  # 【关键改动1】导入正则表达式模块

def clean_illegal_chars(text):
    """
    使用正则表达式移除Excel工作表不支持的非法XML字符。
    """
    # Excel (XML) 不支持的字符范围：
    # \u0000-\u0008, \u000B-\u000C, \u000E-\u001F
    return re.sub(r'[\u0000-\u0008\u000B\u000C\u000E-\u001F]', '', text)

def process_rag_content(rag_cell_data):
    """
    处理单个'rag'单元格的内容，并格式化为带换行的可读文本。
    此版本兼容两种JSON结构：
    1. 扁平结构: {"current_time": ..., "retrieval_results": [...]}
    2. 嵌套结构: {"retrieved_data": [{"data": {"content": "{\"current_time\":...}"}}]}
    """
    if not isinstance(rag_cell_data, str) or not rag_cell_data.strip():
        return ""

    try:
        data = json.loads(rag_cell_data)
        source_data = None

        if 'retrieval_results' in data and 'current_time' in data:
            source_data = data
        
        elif 'retrieved_data' in data:
            try:
                content_str = data['retrieved_data'][0]['data']['content']
                source_data = json.loads(content_str)
            except (KeyError, IndexError, TypeError, json.JSONDecodeError):
                source_data = None
        
        if source_data:
            final_parts = []
            
            current_time = source_data.get('current_time')
            if current_time:
                final_parts.append(f"[查询时间: {current_time}]")

            retrieval_results = source_data.get('retrieval_results', [])
            for result in retrieval_results:
                content = result.get('content')
                if content:
                    timestamp = result.get('page_time', '无时间信息')
                    clean_text = str(content).replace('\\\\n', ' ').replace('\\n', ' ').replace('\n', ' ').replace('\\\\', '\\').strip()
                    formatted_entry = f"[时间: {timestamp}]\n{clean_text}"
                    final_parts.append(formatted_entry)
            
            if not final_parts:
                return " "
            
            final_string = "\n---\n".join(final_parts)
            # 【关键改动2】在返回最终结果前，清洗非法字符
            return clean_illegal_chars(final_string)

        raise ValueError("Unknown JSON structure")

    except (json.JSONDecodeError, ValueError):
        plain_text = str(rag_cell_data).replace('\\\\n', ' ').replace('\\n', ' ').replace('\n', ' ').replace('\\\\', '\\').strip()
        # 【关键改动2】同样对作为纯文本处理的结果进行清洗
        return clean_illegal_chars(plain_text)

def main():
    """
    主函数，用于解析命令行参数、读取文件、处理数据并保存结果。
    """
    parser = argparse.ArgumentParser(
        description="处理表格文件（xlsx/csv）中的'rag'列，并生成新的xlsx文件。",
        epilog="使用示例: python3 process_table.py /path/to/your/file.xlsx"
    )
    parser.add_argument("input_file", help="待处理的xlsx或csv文件路径")
    args = parser.parse_args()
    
    input_path = args.input_file

    if not os.path.exists(input_path):
        print(f"错误: 文件不存在 -> {input_path}")
        sys.exit(1)

    try:
        print(f"正在读取文件: {input_path}")
        file_ext = os.path.splitext(input_path)[1].lower()
        if file_ext == '.xlsx':
            df = pd.read_excel(input_path, engine='openpyxl')
        elif file_ext == '.csv':
            df = pd.read_csv(input_path)
        else:
            print(f"错误: 不支持的文件格式 '{file_ext}'。请输入.xlsx或.csv文件。")
            sys.exit(1)
    except Exception as e:
        print(f"读取文件时发生错误: {e}")
        sys.exit(1)

    if 'rag' not in df.columns:
        print("错误: 文件中未找到名为 'rag' 的表头列。")
        sys.exit(1)

    print("正在处理'rag'列数据...")
    df['rag_processed_md'] = df['rag'].fillna('').apply(process_rag_content)
    print("处理完成！")

    script_dir = os.path.dirname(os.path.abspath(__file__))
    base_name = os.path.splitext(os.path.basename(input_path))[0]
    output_filename = f"{base_name}_processed.xlsx"
    output_path = os.path.join(script_dir, output_filename)
    
    try:
        print(f"正在保存结果到: {output_path}")
        df.to_excel(output_path, index=False, engine='openpyxl')
        print("文件保存成功！")
    except Exception as e:
        print(f"保存文件时发生错误: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
