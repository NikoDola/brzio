import Navbar from '@/components/sections/Navbar/Navbar';
import Hero from '@/components/sections/Hero/Hero';
import Problem from '@/components/sections/HowToConnect/HowToConnect';
import Solution from '@/components/sections/Solution/Solution';
import HowItWorks from '@/components/sections/HowItWorks/HowItWorks';
import Trust from '@/components/sections/Trust/Trust';
import Offer from '@/components/sections/Offer/Offer';
import FAQ from '@/components/sections/FAQ/FAQ';
import ContactForm from '@/components/sections/ContactForm/ContactForm';
import Footer from '@/components/sections/Footer/Footer';

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Problem />
        <Solution />
        <HowItWorks />
        <Trust />
        <Offer />
        <FAQ />
        <ContactForm />
      </main>
      <Footer />
    </>
  );
}
