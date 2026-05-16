import NavBar from "@/components/sections/NavBar";

export default function ServicesLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <NavBar />
      <main>{children}</main>
    </>
  );
}
