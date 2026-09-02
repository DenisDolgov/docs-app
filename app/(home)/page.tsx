import { Button } from '@/components/ui/button';

import { HomeNavbar } from './home-navbar';

const Home = () => {
  return (
    <div className="flex flex-col min-h-screen">
      <div className="fixed top-0 left-0 right-0 z-10 h-16 bg-white p-4">
        <HomeNavbar />
      </div>
      <div className="mt-16">
        <p>Hello world!</p>
        <Button>Button</Button>
      </div>
    </div>
  );
};

export default Home;
