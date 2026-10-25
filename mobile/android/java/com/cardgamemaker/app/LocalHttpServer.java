package com.cardgamemaker.app;

import android.content.res.AssetManager;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.URLDecoder;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/**
 * 极简本地静态 HTTP 服务（仅 127.0.0.1，Java ServerSocket，无第三方依赖）。
 *
 * 从 APK 的 assets/www 目录提供前端构建产物：
 *   GET /            -> www/index.html
 *   GET /index.html  -> www/index.html
 *   GET /assets/x.js -> www/assets/x.js
 *   GET /audio/x.ogg -> www/audio/x.ogg
 * 支持 GET/HEAD、常见 MIME、简单 Range（音频拖动进度用）、SPA 回退（无扩展名 404 -> index.html）。
 */
public class LocalHttpServer {

    private static final String ASSET_ROOT = "www/";
    private static final int SOCKET_TIMEOUT_MS = 20000;
    private static final Map<String, String> MIME = new HashMap<>();

    static {
        MIME.put("html", "text/html; charset=utf-8");
        MIME.put("htm", "text/html; charset=utf-8");
        MIME.put("js", "application/javascript; charset=utf-8");
        MIME.put("mjs", "application/javascript; charset=utf-8");
        MIME.put("css", "text/css; charset=utf-8");
        MIME.put("json", "application/json; charset=utf-8");
        MIME.put("map", "application/json; charset=utf-8");
        MIME.put("txt", "text/plain; charset=utf-8");
        MIME.put("svg", "image/svg+xml");
        MIME.put("png", "image/png");
        MIME.put("jpg", "image/jpeg");
        MIME.put("jpeg", "image/jpeg");
        MIME.put("webp", "image/webp");
        MIME.put("gif", "image/gif");
        MIME.put("ico", "image/x-icon");
        MIME.put("ogg", "audio/ogg");
        MIME.put("oga", "audio/ogg");
        MIME.put("wav", "audio/wav");
        MIME.put("mp3", "audio/mpeg");
        MIME.put("m4a", "audio/mp4");
        MIME.put("woff", "font/woff");
        MIME.put("woff2", "font/woff2");
        MIME.put("ttf", "font/ttf");
        MIME.put("otf", "font/otf");
    }

    private final AssetManager assets;
    private final int port;
    private ServerSocket serverSocket;
    private Thread acceptThread;
    private volatile boolean running;

    public LocalHttpServer(AssetManager assets, int port) {
        this.assets = assets;
        this.port = port;
    }

    /** 绑定端口并启动接收线程；绑定失败会抛 IOException（端口占用等）。 */
    public void start() throws IOException {
        serverSocket = new ServerSocket();
        serverSocket.setReuseAddress(true);
        serverSocket.bind(new InetSocketAddress(InetAddress.getByName("127.0.0.1"), port));
        running = true;
        acceptThread = new Thread(new Runnable() {
            @Override
            public void run() {
                while (running) {
                    try {
                        final Socket socket = serverSocket.accept();
                        Thread worker = new Thread(new Runnable() {
                            @Override
                            public void run() {
                                handle(socket);
                            }
                        }, "cgm-http-client");
                        worker.setDaemon(true);
                        worker.start();
                    } catch (IOException e) {
                        if (running) {
                            // accept 失败时短暂等待，避免死循环占满 CPU
                            try {
                                Thread.sleep(50);
                            } catch (InterruptedException ignored) {
                            }
                        }
                    }
                }
            }
        }, "cgm-http-accept");
        acceptThread.setDaemon(true);
        acceptThread.start();
    }

    public void stop() {
        running = false;
        try {
            if (serverSocket != null) serverSocket.close();
        } catch (IOException ignored) {
        }
        serverSocket = null;
        acceptThread = null;
    }

    private void handle(Socket socket) {
        try {
            socket.setSoTimeout(SOCKET_TIMEOUT_MS);
            InputStream in = socket.getInputStream();
            OutputStream out = socket.getOutputStream();

            String requestLine = readLine(in);
            if (requestLine == null || requestLine.isEmpty()) {
                return;
            }
            String[] parts = requestLine.split(" ");
            if (parts.length < 2) {
                writeSimple(out, 400, "Bad Request", "text/plain; charset=utf-8", "Bad Request".getBytes("UTF-8"));
                return;
            }
            String method = parts[0];
            String rawPath = parts[1];

            // 读掉请求头，解析 Range
            long rangeStart = -1;
            long rangeEnd = -1;
            boolean hasRange = false;
            String header;
            while ((header = readLine(in)) != null && !header.isEmpty()) {
                int colon = header.indexOf(':');
                if (colon <= 0) continue;
                String name = header.substring(0, colon).trim().toLowerCase(Locale.US);
                String value = header.substring(colon + 1).trim();
                if ("range".equals(name) && value.startsWith("bytes=")) {
                    String spec = value.substring(6);
                    int dash = spec.indexOf('-');
                    if (dash >= 0) {
                        try {
                            String a = spec.substring(0, dash).trim();
                            String b = spec.substring(dash + 1).trim();
                            if (!a.isEmpty()) rangeStart = Long.parseLong(a);
                            if (!b.isEmpty()) rangeEnd = Long.parseLong(b);
                            hasRange = true;
                        } catch (NumberFormatException ignored) {
                        }
                    }
                }
            }

            if (!"GET".equals(method) && !"HEAD".equals(method)) {
                writeSimple(out, 405, "Method Not Allowed", "text/plain; charset=utf-8", "Only GET/HEAD".getBytes("UTF-8"));
                return;
            }

            String path = rawPath;
            int q = path.indexOf('?');
            if (q >= 0) path = path.substring(0, q);
            int hash = path.indexOf('#');
            if (hash >= 0) path = path.substring(0, hash);
            try {
                path = URLDecoder.decode(path, "UTF-8");
            } catch (Exception ignored) {
            }
            if (path == null || path.isEmpty() || "/".equals(path)) {
                path = "/index.html";
            }
            if (path.indexOf("..") >= 0) {
                writeSimple(out, 403, "Forbidden", "text/plain; charset=utf-8", "Forbidden".getBytes("UTF-8"));
                return;
            }
            if (path.startsWith("/")) path = path.substring(1);

            byte[] data = readAsset(path);
            if (data == null) {
                // SPA 回退：无扩展名的路径一律返回 index.html（前端路由/刷新用）
                String last = path.substring(path.lastIndexOf('/') + 1);
                if (last.indexOf('.') < 0) {
                    path = "index.html";
                    data = readAsset(path);
                }
            }
            if (data == null) {
                writeSimple(out, 404, "Not Found", "text/plain; charset=utf-8", "Not Found".getBytes("UTF-8"));
                return;
            }

            String mime = mimeType(path);
            boolean isIndex = "index.html".equals(path);
            boolean head = "HEAD".equals(method);

            if (hasRange && data.length > 0) {
                long start = rangeStart >= 0 ? rangeStart : 0;
                long end = rangeEnd >= 0 ? rangeEnd : data.length - 1;
                if (start < 0) start = 0;
                if (end >= data.length) end = data.length - 1;
                if (start > end || start >= data.length) {
                    out.write(("HTTP/1.1 416 Range Not Satisfiable\r\n" +
                            "Content-Range: bytes */" + data.length + "\r\n" +
                            "Connection: close\r\n\r\n").getBytes("UTF-8"));
                    out.flush();
                    return;
                }
                int len = (int) (end - start + 1);
                StringBuilder sb = new StringBuilder();
                sb.append("HTTP/1.1 206 Partial Content\r\n");
                sb.append("Content-Type: ").append(mime).append("\r\n");
                sb.append("Content-Length: ").append(len).append("\r\n");
                sb.append("Content-Range: bytes ").append(start).append("-").append(end).append("/").append(data.length).append("\r\n");
                sb.append("Accept-Ranges: bytes\r\n");
                sb.append("Cache-Control: ").append(isIndex ? "no-cache" : "public, max-age=3600").append("\r\n");
                sb.append("Connection: close\r\n\r\n");
                out.write(sb.toString().getBytes("UTF-8"));
                if (!head) out.write(data, (int) start, len);
            } else {
                StringBuilder sb = new StringBuilder();
                sb.append("HTTP/1.1 200 OK\r\n");
                sb.append("Content-Type: ").append(mime).append("\r\n");
                sb.append("Content-Length: ").append(data.length).append("\r\n");
                sb.append("Accept-Ranges: bytes\r\n");
                sb.append("Cache-Control: ").append(isIndex ? "no-cache" : "public, max-age=3600").append("\r\n");
                sb.append("Connection: close\r\n\r\n");
                out.write(sb.toString().getBytes("UTF-8"));
                if (!head) out.write(data);
            }
            out.flush();
        } catch (Exception ignored) {
            // 单连接异常不影响服务
        } finally {
            try {
                socket.close();
            } catch (IOException ignored) {
            }
        }
    }

    private byte[] readAsset(String path) {
        InputStream is = null;
        try {
            is = assets.open(ASSET_ROOT + path);
            ByteArrayOutputStream bos = new ByteArrayOutputStream(Math.max(1024, is.available()));
            byte[] buf = new byte[16384];
            int n;
            while ((n = is.read(buf)) > 0) bos.write(buf, 0, n);
            return bos.toByteArray();
        } catch (Exception e) {
            return null;
        } finally {
            if (is != null) {
                try {
                    is.close();
                } catch (IOException ignored) {
                }
            }
        }
    }

    private static String mimeType(String path) {
        int dot = path.lastIndexOf('.');
        if (dot >= 0) {
            String ext = path.substring(dot + 1).toLowerCase(Locale.US);
            String mime = MIME.get(ext);
            if (mime != null) return mime;
        }
        return "application/octet-stream";
    }

    private static void writeSimple(OutputStream out, int code, String text, String mime, byte[] body) throws IOException {
        String head = "HTTP/1.1 " + code + " " + text + "\r\n" +
                "Content-Type: " + mime + "\r\n" +
                "Content-Length: " + body.length + "\r\n" +
                "Connection: close\r\n\r\n";
        out.write(head.getBytes("UTF-8"));
        out.write(body);
        out.flush();
    }

    /** 从 InputStream 读一行 ASCII（请求行/头）。 */
    private static String readLine(InputStream in) throws IOException {
        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        int b;
        while ((b = in.read()) != -1) {
            if (b == '\n') break;
            if (b != '\r') bos.write(b);
            if (bos.size() > 8192) break;
        }
        if (b == -1 && bos.size() == 0) return null;
        return new String(bos.toByteArray(), "UTF-8");
    }
}
