import axios, { AxiosHeaders, type AxiosRequestConfig, type RawAxiosHeaders } from "axios";

const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

const api = axios.create({
  baseURL: API_BASE_URL,
});

const isPublicAuthEndpoint = (url?: string) => {
  if (!url) return false;

  return url.startsWith("/auth/") || url.includes("/api/auth/");
};

const setAuthorizationHeader = (config: AxiosRequestConfig, token: string) => {
  const headers = AxiosHeaders.from(
    config.headers as AxiosHeaders | RawAxiosHeaders | undefined,
  );
  headers.delete("Authorization");
  headers.set("Authorization", `Bearer ${token}`);
  config.headers = headers;
};

const removeAuthorizationHeader = (config: AxiosRequestConfig) => {
  const headers = AxiosHeaders.from(
    config.headers as AxiosHeaders | RawAxiosHeaders | undefined,
  );
  headers.delete("Authorization");
  config.headers = headers;
};

api.interceptors.request.use(
  function (config) {
    const token = getAccessToken();

    if (isPublicAuthEndpoint(config.url)) {
      removeAuthorizationHeader(config);
      return config;
    }

    if (token) {
      setAuthorizationHeader(config, token);
    }
    return config;
  },

  function (error) {
    return Promise.reject(error);
  },
);

//========= kiểm tra refresh token===========
let isRefreshing = false; // Đánh dấu hiện tại có đang gọi API refresh token hay không.
let failedQueue: any[] = []; // Lưu danh sách yêu cầu bị lỗi 401 trong hàng đợi.

//--------hàm xử lý hàng chờ----------------------
const processQueue = (error: any, token: string | null) => {
  failedQueue.forEach((prom) => {
    if (error)
      prom.reject(error); // Yêu cầu đang chờ sẽ bị từ chối.
    else prom.resolve(token); // Tất cả yêu cầu đang chờ sẽ được tiếp tục với token mới.
  });
  failedQueue = [];
};

const redirectToLogin = async () => {
  store.dispatch(clearAuth());
  store.dispatch(clearCurrentUser());
  clearAuthTokens();
  delete api.defaults.headers.common["Authorization"];
  await persistor.flush();
  window.location.replace(`${ROUTES.AUTH_PAGE}/${ROUTES.LOGIN_PAGE}`);
};

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<any>) => {
    const originalRequest = error.config as AxiosRequestConfig & {
      _retry?: boolean;
    };

    const isUnauthorized =
      error.response?.status === 401 || error.response?.data?.code === 401;

    // Security handlers return different messages for missing, invalid, and
    // expired access tokens. Refresh protected requests once for every 401.
    if (
      isUnauthorized &&
      !isPublicAuthEndpoint(originalRequest.url) &&
      !originalRequest._retry
    ) {
      if (isRefreshing) {
        // Nếu refresh đang diễn ra, xếp yêu cầu này vào hàng chờ.
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            setAuthorizationHeader(originalRequest, String(token));
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }
      originalRequest._retry = true;
      isRefreshing = true;
      try {
        const refreshToken = getRefreshToken();
        if (!refreshToken) throw new Error("No refresh token found");

        // Gửi yêu cầu refresh token.
        const res = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          token: refreshToken,
        });

        const { accessToken: newToken, refreshToken: newRefreshToken } =
          res.data.result;

        if (!newToken || !newRefreshToken) {
          throw new Error("Refresh response does not contain auth tokens");
        }

        // Lưu lại token mới.
        setAuthTokens(newToken, newRefreshToken);

        // Cập nhật header mặc định cho axios.
        api.defaults.headers.common["Authorization"] = `Bearer ${newToken}`;
        processQueue(null, newToken);

        // Gửi lại yêu cầu cũ.
        setAuthorizationHeader(originalRequest, newToken);
        return api(originalRequest);

        // Nếu có lỗi thì cho đăng nhập lại.
      } catch (refreshError) {
        processQueue(refreshError, null);
        toast.error("Phiên đã hết hạn, vui lòng đăng nhập lại");
        await redirectToLogin();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  },
);

export default api;