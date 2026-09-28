// Next's font transform matches the exact specifier "next/font/google", which nodenext resolution
// can't find without a file extension; this points the types at the file it means.
declare module "next/font/google" {
  export * from "next/font/google/index.js";
}
