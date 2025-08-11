import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { proxy } from "https://deno.land/x/http_proxy@0.4.0/mod.ts";

// 允许的目标API白名单（严格限制）
const ALLOWED_APIS = [
  "https://api4.thetvdb.com",
  "https://api.trakt.tv",
  "https://api.mdblist.com"
];

// 允许的跨域来源，生产环境中应限制为你的前端域名
const ALLOWED_ORIGINS = Deno.env.get("ALLOWED_ORIGINS")?.split(",") || ["*"];

// 检查目标URL是否在白名单中
function isAllowedTarget(targetUrl: string): boolean {
  // 检查目标URL是否以白名单中的任一API开头
  return ALLOWED_APIS.some(allowed => targetUrl.startsWith(allowed));
}

// 从路径中提取目标API URL
function extractTargetUrl(path: string): string | null {
  // 移除路径开头的斜杠
  const encodedUrl = path.slice(1);
  
  if (!encodedUrl) {
    return null;
  }
  
  // 简单验证URL格式
  try {
    // 检查是否是合法URL
    new URL(encodedUrl);
    return encodedUrl;
  } catch (e) {
    return null;
  }
}

// 处理请求的主函数
async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  
  // 从路径中提取目标URL
  const targetUrl = extractTargetUrl(url.pathname);
  
  // 验证目标URL
  if (!targetUrl || !isAllowedTarget(targetUrl)) {
    return new Response(
      JSON.stringify({ 
        error: "不允许的API访问", 
        message: "仅支持加速以下API: " + ALLOWED_APIS.join(", ")
      }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }
  
  // 构建完整的目标URL（包含查询参数）
  const fullTargetUrl = new URL(targetUrl);
  fullTargetUrl.search = url.search;

  // 复制并处理请求头
  const headers = new Headers(request.headers);
  
  // 设置目标API所需的主机头
  headers.set("Host", new URL(targetUrl).hostname);
  
  // 移除可能引起问题的头
  headers.delete("origin");
  headers.delete("referer");

  try {
    // 代理请求
    const response = await proxy(request, fullTargetUrl.toString(), {
      headers: headers
    });

    // 处理跨域
    const origin = request.headers.get("origin") || "";
    const allowedOrigin = ALLOWED_ORIGINS.includes("*") 
      ? origin 
      : ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

    // 创建新的响应头，添加CORS支持
    const newHeaders = new Headers(response.headers);
    newHeaders.set("Access-Control-Allow-Origin", allowedOrigin);
    newHeaders.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    newHeaders.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    newHeaders.set("Access-Control-Expose-Headers", "*");

    // 返回代理的响应
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders
    });
  } catch (error) {
    console.error("代理请求错误:", error);
    return new Response(
      JSON.stringify({ error: "代理请求失败", details: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// 处理OPTIONS请求（预检请求）
function handleOptions(request: Request): Response {
  const origin = request.headers.get("origin") || "";
  const allowedOrigin = ALLOWED_ORIGINS.includes("*") 
    ? origin 
    : ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": allowedOrigin,
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
}

// 启动服务器
const PORT = parseInt(Deno.env.get("PORT") || "8000");
console.log(`API加速服务已启动，监听端口 ${PORT}`);
console.log("支持的API:");
ALLOWED_APIS.forEach(api => {
  console.log(`- ${api}`);
});
console.log("使用方式: http://你的域名.deno.dev/${目标API完整URL}");

serve((req) => {
  if (req.method === "OPTIONS") {
    return handleOptions(req);
  } else {
    return handleRequest(req);
  }
}, { port: PORT });
    
