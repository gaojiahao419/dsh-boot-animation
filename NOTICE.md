# NOTICE / 第三方素材声明

本仓库是非官方的粉丝项目，与 DeepSeek（深度求索）没有任何隶属、合作或背书关系。

## DeepSeek 名称与鲸鱼标识

- `research/whale.svg` 中的鲸鱼矢量路径取自 DeepSeek 官方站点（`https://www.deepseek.com/`）内联 logo，用于还原 DeepSeek Harness 的开机画面。
- “DeepSeek”“DeepSeek Harness”及鲸鱼标识是 DeepSeek 的商标/品牌资产，权利归 DeepSeek 所有。
- 本项目中的使用仅用于非官方的个人/演示性开机动画；如需商用、再分发或用于与你无关的产品，请自行取得授权或替换为自有标识。

## 背景着色器

- `src/boot.template.js` 中的流体背景着色器是根据 `https://www.deepseek.com/harness/` 页面的公开 WebGL 背景效果改写/压缩而来，用于营造近似的品牌氛围。
- 原始网页代码及视觉设计的权利归 DeepSeek 所有；本项目不声称拥有该着色器的原创权利。商用前建议替换为独立实现。

## 语音与音效

- `welcome-edge.mp3`、`tagline-edge.mp3` 由 Microsoft Edge TTS（`zh-CN-XiaoxiaoNeural`）生成，并经 `tools/process-voice.mjs` 做离线处理。
- 生成音频的使用可能受 Microsoft 服务条款约束；仓库中的音频仅用于演示。商用或公开发布前请替换为你有权使用的配音。
- `sfx-*.wav` 由 `tools/make-sfx.py` 程序化合成。

## 灵感来源

- 视觉参考：DeepSeek Harness 官网 <https://www.deepseek.com/harness/>。
- 机械女声风格参考：Bilibili 视频 `BV1b18q6wEr7`（仅作为风格参考，未使用该视频的任何音频或画面素材）。

## 代码

- 本仓库中由作者编写的源代码采用 MIT License（见 `LICENSE`）。
- 上述第三方商标、品牌资产、背景效果与生成音频不属于 MIT 授权范围，其权利归各自所有者。
