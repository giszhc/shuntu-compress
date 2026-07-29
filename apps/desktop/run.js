// 包装入口：直接 require 真实主进程代码。
// 用于验证直接传 out/main/index.js 作为 entry 是否因被 electron 识别为
// package.json 的 main 而触发沙箱内 V8 snapshot 断言崩溃。
require('./out/main/index.js');
