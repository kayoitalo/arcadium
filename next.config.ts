import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /**
   * O Spotify não aceita mais "localhost" como redirect URI, só o IP de
   * loopback. Mas o Next trata 127.0.0.1 como outra origem e bloqueia os
   * assets de /_next/ vindos dela — o HTML chega, o React não hidrata, e a
   * tela aparece montada e vazia, sem erro nenhum.
   *
   * Liberar a origem aqui é o que permite rodar o fluxo do Spotify local.
   */
  allowedDevOrigins: ['127.0.0.1', 'localhost'],

  experimental: {
    useTypeScriptCli: true,
  },
};

export default nextConfig;
