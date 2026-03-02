import React from "react";
import ReactDOM from "react-dom/client";
import { ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import dayjs from "dayjs";
import "dayjs/locale/zh-cn";
import App from "./App";

dayjs.locale("zh-cn");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConfigProvider locale={zhCN} theme={{
      token: {
        colorPrimary: "#2c2c2c",
        borderRadius: 8,
        colorBgContainer: "#ffffff",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro', 'Inter', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif",
      }
    }}>
      <App />
    </ConfigProvider>
  </React.StrictMode>
);
