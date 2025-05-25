// 导入所需模块
import { serve } from "https://deno.land/std@0.182.0/http/server.ts";

// 启动HTTP服务
serve(async (request) => {
  const url = new URL(request.url);
  
  // 验证路径是否符合要求
  if (!url.pathname.startsWith("/tmdb/")) {
    return new Response("Not Found", { status: 404 });
  }

  // 构建目标URL
  const targetPath = url.pathname.replace("/tmdb", "");
  const targetUrl = new URL(`https://image.tmdb.org${targetPath}${url.search}`);

  try {
    // 转发请求到目标服务器
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: {
        // 过滤并设置合适的请求头
        "User-Agent": "Deno-Proxy/1.0",
        "Accept": request.headers.get("Accept") || "*/*",
      },
      redirect: "follow",
    });

    // 处理响应头
    const headers = new Headers(response.headers);
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
    headers.delete("Content-Security-Policy");

    // 返回代理响应
    return new Response(response.body, {
      status: response.status,
      headers,
    });
  } catch (error) {
    console.error("Proxy Error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
});

console.log("Proxy server running at http://localhost:8000");
