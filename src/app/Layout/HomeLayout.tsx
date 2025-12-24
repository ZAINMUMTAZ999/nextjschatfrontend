
import React from "react";



type Props = {
  children: React.ReactNode;
};

const HomeLayout = ({ children }: Props) => {
  return (
  
    <div className="min-h-screen flex flex-col   bg-white">
  

          {children}


    </div>
   
  );
};

export default HomeLayout;