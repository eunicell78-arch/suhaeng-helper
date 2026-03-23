import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // GitHub Pages 배포 시 레포 이름을 base로 설정
  // 예: https://username.github.io/suhaeng-helper → base: "/suhaeng-helper/"
  // 커스텀 도메인 or username.github.io 이면 base: "/"
  base: "./",
});
