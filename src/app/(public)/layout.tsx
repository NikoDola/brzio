import NavBar from "@/components/sections/NavBar";
import Footer from "@/components/sections/Footer";
import H2LineEffect from "@/components/ui/H2LineEffect";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <NavBar />
      <H2LineEffect />
      <main>{children}</main>
      <Footer />
    </>
  );
}
