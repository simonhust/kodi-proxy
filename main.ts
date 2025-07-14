import { serve } from "https://deno.land/std@0.182.0/http/server.ts";

// 代理配置映射------
const PROXY_CONFIG = [
  {
    pathPrefix: "/tmdb/",
    targetBase: "https://image.tmdb.org",
    cacheControl: "public, max-age=31536000, immutable"
  },
  {
    pathPrefix: "/fanart-m/",
    targetBase: "https://webservice.fanart.tv/v3",
    cacheControl: "public, max-age=86400",
    // 需要设置环境变量 FANART_API_KEY
    authParams: { api_key: Deno.env.get("FANART_API_KEY") }
  }
];

// 处理代理逻辑
async function handleProxy(request: Request) {
  const url = new URL(request.url);
  
  // 查找匹配的代理配置
  const config = PROXY_CONFIG.find(c => url.pathname.startsWith(c.pathPrefix));
  if (!config) return new Response("Not Found", { status: 404 });

  try {
    // 构建目标URL
    const targetPath = url.pathname.replace(config.pathPrefix, "");
    const targetUrl = new URL(targetPath + url.search, config.targetBase);

    // 添加认证参数
    if (config.authParams) {
      Object.entries(config.authParams).forEach(([key, value]) => {
        if (value) targetUrl.searchParams.set(key, value);
      });
    }

    // 转发请求
    const proxyResponse = await fetch(targetUrl, {
      method: request.method,
      headers: filterHeaders(request.headers),
      redirect: "follow",
      body: request.body
    });

    // 处理响应头
    const headers = new Headers(proxyResponse.headers);
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("Cache-Control", config.cacheControl);
    headers.delete("Content-Security-Policy");

    return new Response(proxyResponse.body, {
      status: proxyResponse.status,
      headers
    });
  } catch (error) {
    console.error(`Proxy Error: ${error}`);
    return new Response("Internal Server Error", { status: 500 });
  }
}

// 过滤请求头
function filterHeaders(headers: Headers): HeadersInit {
  return {
    "Accept": headers.get("Accept") || "*/*",
    "User-Agent": "Deno-Proxy/1.0",
    // 可添加其他需要透传的请求头
  };
}

// 启动服务
serve(handleProxy);
console.log("Proxy server running at http://localhost:8000");
