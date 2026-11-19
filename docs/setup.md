# 装配与烧录

## 设备信息

| 项 | 值 |
|----|----|
| 整机 | M5Stack StackChan (K151)，CoreS3 主控 |
| 主控 | ESP32-S3，16MB Flash / 8MB PSRAM |
| MAC | 示例 `AA:BB:CC:DD:EE:FF`（以你自己设备为准） |
| USB 串口 | 示例 COM3（原生 USB-Serial/JTAG，VID 303A；以实际端口为准） |
| 家用 Wi-Fi | `YOUR_WIFI_2G`（2.4G，设备仅支持 2.4G；5G 频段不可用） |

## 固件历程

| 日期 | 固件 | 方式 | 备注 |
|------|------|------|------|
| 2026-11-18 | 出厂固件 | — | 已用 esptool 全片备份到 `.local/releases/factory-firmware-backup.bin` |
| 2026-11-18 | QChan v4-20261009（Qoder 联名） | M5Burner 桌面版 | 跑通语音对话；固件锁定 Qoder 云端，无法换后端 |
| 2026-11-18 | stackchan-xiaozhi-firmware v1.0.0（社区） | esptool | 当前固件，xiaozhi 系，支持 MCP 工具扩展 |

## 烧录步骤（当前固件）

预编译 bin 来自 [heavenchenggong/stackchan-xiaozhi-firmware Releases](https://github.com/heavenchenggong/stackchan-xiaozhi-firmware/releases)（注意：桥接主仓库的 Releases 为空，固件在这个独立仓库）。

```powershell
pip install esptool
# 初刷需整片擦除（会清掉 NVS 里的 Wi-Fi 凭据）；esptool v5 不支持 erase+write 链式调用，分两步
# COM3 换成你的实际串口
python -m esptool --chip esp32s3 -p COM3 -b 921600 erase-flash
python -m esptool --chip esp32s3 -p COM3 -b 921600 --after hard-reset write-flash --flash-mode dio --flash-size 16MB --flash-freq 80m 0x0 .local\releases\stackchan-xiaozhi-v1.0.0-merged.bin
```

回滚出厂固件：`write-flash 0x0 .local\releases\factory-firmware-backup.bin`（同样参数）。

## 配网（踩坑实录）

1. 设备屏幕显示热点名（如 `XiaoZhi-xxxx` / QChan 时期为 `QoderChan-xxxx`，后缀为设备 MAC 后四位）
2. 手机连热点，浏览器开 **`http://192.168.4.1`**
   - **必须 http**，https 打不开（设备无证书）；浏览器会自动升级 https 时手动输全 `http://`
   - **关掉手机移动数据**，否则请求走蜂窝网络到不了设备
   - **关掉手机浏览器的"云端加速"**（或换系统浏览器/Chrome），加速通道走云服务器，到不了局域网设备
   - 电脑访问需要**关系统代理**或把 192.168.4.1 加入代理绕过列表
3. 若热点 DHCP 异常（拿到 169.254.x.x）：手机 Wi-Fi 高级设置改静态 IP
   `192.168.4.2 / 255.255.255.0 / 网关 192.168.4.1 / DNS 192.168.4.1`
4. 配网页选 **2.4G** Wi-Fi，输密码，Connect，设备重启联网

## 小智账号绑定

- 正常流程：设备联网后屏幕显示 6 位激活码 → xiaozhi.me 控制台添加设备
- 踩坑：部分设备 MAC 出厂已被云端预绑定（启动日志直接 `Activation done`、不显示激活码）。
  此时到 xiaozhi.me 控制台各智能体的设备列表查绑定归属；若不在自己账号下，
  附设备 ID 与 MAC 联系官方支持（xiaozhi.ai@tenclass.com）申请解绑
- 智能体语言模型选 **Qwen 系列**
- MCP 接入点：智能体配置 → MCP 设置 → 获取 MCP 接入点 → `wss://api.xiaozhi.me/mcp/?token=...`
  （token 是凭据，只放 `src/qwen-bridge/.env`，已 gitignore）

## 桥接服务启动

```powershell
cd src\qwen-bridge
pip install -r requirements.txt   # 注意 mcp 需 <2（2.x 改名了 FastMCP）
python mcp_pipe.py
```

看到 `Successfully connected` + `ListToolsRequest` 即上线。