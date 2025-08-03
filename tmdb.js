exports.handler = async (event, context) => {
  // 代理配置映射
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
      // 使用环境变量 FANART_API_KEY
      authParams: { api_key: process.env.FANART_API_KEY }
    }
  ];

  try {
    const url = new URL(event.rawUrl);
    
    // 查找匹配的代理配置
    const config = PROXY_CONFIG.find(c => url.pathname.startsWith(c.pathPrefix));
    if (!config) {
      return {
        statusCode: 404,
        body: "Not Found"
      };
    }

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
    const proxyResponse = await fetch(targetUrl.toString(), {
      method: event.httpMethod,
      headers: {
        "Accept": event.headers.accept || "*/*",
        "User-Agent": "Netlify-Proxy/1.0",
        ...(event.headers.authorization ? { "Authorization": event.headers.authorization } : {})
      },
      body: event.body ? Buffer.atob(event.body) : undefined,
      redirect: "follow"
    });

    // 处理响应头
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": config.cacheControl,
      "Content-Type": proxyResponse.headers.get("Content-Type") || ""
    };

    // 读取响应内容
    const responseBody = await proxyResponse.arrayBuffer();
    
    return {
      statusCode: proxyResponse.status,
      headers,
      body: Buffer.from(responseBody).toString('base64'),
      isBase64Encoded: true
    };
  } catch (error) {
    console.error(`Proxy Error: ${error}`);
    return {
      statusCode: 500,
      body: "Internal Server Error"
    };
  }
};
