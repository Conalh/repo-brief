/** @type {import('next').NextConfig} */
const nextConfig = {
  // @repobrief/core is a workspace TS package compiled by Next.
  transpilePackages: ['@repobrief/core'],
  // node:sqlite is a built-in; keep it external from the bundle.
  serverExternalPackages: ['node:sqlite'],
};

export default nextConfig;
