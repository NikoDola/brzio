import NavBar from "@/components/sections/NavBar";
import Footer from "@/components/sections/Footer";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <NavBar />
      <main>{children}</main>
      <Footer />
    </>
  );
}
