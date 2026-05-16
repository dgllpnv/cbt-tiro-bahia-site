import Header from '@/components/Header';
import Hero from '@/components/Hero';
import About from '@/components/About';
import Courses from '@/components/Courses';
import News from '@/components/News';
import Gallery from '@/components/Gallery';
import Partners from '@/components/Partners';
import Location from '@/components/Location';
import Contact from '@/components/Contact';
import Footer from '@/components/Footer';

const Index = () => {
  return (
    <div className="min-h-screen bg-black text-white">
      <Header />
      <Hero />
      <About />
      <Courses />
      <News />
      <Gallery />
      <Partners />
      <Location />
      <Contact />
      <Footer />
    </div>
  );
};

export default Index;
