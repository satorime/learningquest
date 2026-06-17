"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";

interface AccomplishmentDay {
  date: string;
  accomplishments: number;
  dayOfWeek: number;
}

interface AccomplishmentGraphProps {
  data: AccomplishmentDay[];
}

const AccomplishmentGraph: React.FC<AccomplishmentGraphProps> = ({ data }) => {
  // Process data to display in a grid (similar to GitHub contribution graph)
  // Each row represents a day of the week (0 = Sunday, 6 = Saturday)
  // Each column represents a week

  const weeks = Math.ceil(data.length / 7);
  const processedData: AccomplishmentDay[][] = Array(7)
    .fill(null)
    .map(() => Array(weeks).fill(null));

  // Fill in the grid with data
  data.forEach((day, index) => {
    const weekIndex = Math.floor(index / 7);
    const dayOfWeek = day.dayOfWeek;
    processedData[dayOfWeek][weekIndex] = day;
  });

  // Calculate current and longest accomplishment streaks
  const calculateCurrentStreak = (data: AccomplishmentDay[]): number => {
    let currentStreak = 0;

    // Start from the most recent day
    for (let i = data.length - 1; i >= 0; i--) {
      if (data[i].accomplishments > 0) {
        currentStreak++;
      } else {
        break;
      }
    }

    return currentStreak;
  };

  // Calculate longest accomplishment streak
  const calculateLongestStreak = (data: AccomplishmentDay[]): number => {
    let longestStreak = 0;
    let currentStreak = 0;

    for (let i = 0; i < data.length; i++) {
      if (data[i].accomplishments > 0) {
        currentStreak++;
        longestStreak = Math.max(longestStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    }

    return longestStreak;
  };

  const currentStreak = calculateCurrentStreak(data);
  const longestStreak = calculateLongestStreak(data);

  // GitHub-style colors for accomplishments
  const getColor = (accomplishments: number): string => {
    switch (accomplishments) {
      case 0:
        return "#ebedf0"; // No accomplishments
      case 1:
        return "#9be9a8"; // 1-2 accomplishments
      case 2:
        return "#40c463"; // 3-4 accomplishments
      case 3:
        return "#30a14e"; // 5-6 accomplishments
      case 4:
        return "#216e39"; // 7+ accomplishments
      default:
        return "#ebedf0";
    }
  };

  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="accomplishment-graph">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
        <Card
          className="border-none shadow-md transition-shadow duration-300"
          style={{ background: "linear-gradient(145deg, #ffffff, #f5f0ff)" }}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-[#9370DB]">
              Current Accomplishment Streak
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[#6A5ACD]">
              {currentStreak} days
            </div>
          </CardContent>
        </Card>

        <Card
          className="border-none shadow-md transition-shadow duration-300"
          style={{ background: "linear-gradient(145deg, #ffffff, #fff0f0)" }}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-[#F88379]">
              Longest Accomplishment Streak
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[#E56B75]">
              {longestStreak} days
            </div>
          </CardContent>
        </Card>

        <Card
          className="border-none shadow-md transition-shadow duration-300"
          style={{ background: "linear-gradient(145deg, #ffffff, #f5f0ff)" }}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-[#9370DB]">
              Total Accomplishment Days
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[#6A5ACD]">
              {data.filter((day) => day.accomplishments > 0).length} days
            </div>
          </CardContent>
        </Card>
      </div>

      <Card
        className="border-none shadow-md hover:shadow-lg transition-shadow duration-300 p-3 sm:p-6 overflow-x-auto"
        style={{ background: "linear-gradient(145deg, #ffffff, #f8f5ff)" }}
      >
        <div className="min-w-[340px]">
        <div className="flex items-start mb-4">
          <div className="w-8 sm:w-12 flex-shrink-0"></div>
          <div
            className="flex-1 grid grid-cols-15 gap-1 text-[10px] sm:text-xs text-gray-500"
            style={{ gridTemplateColumns: "repeat(15, 1fr)" }}
          >
            {Array(15)
              .fill(null)
              .map((_, i) => (
                <div key={i} className="text-center">
                  {i % 2 === 0 ? `W${15 - i}` : ""}
                </div>
              ))}
          </div>
        </div>

        <div className="flex items-start">
          <div className="w-8 sm:w-12 flex-shrink-0 flex flex-col justify-around">
            {dayLabels.map((day, i) => (
              <div key={i} className="h-3 text-[10px] sm:text-xs text-gray-500 pr-1 sm:pr-2 leading-3">
                {day}
              </div>
            ))}
          </div>

          <div className="flex-1">
            <div
              className="grid grid-rows-7 gap-1"
              style={{ gridTemplateRows: "repeat(7, 1fr)" }}
            >
              {processedData.map((row, rowIndex) => (
                <div
                  key={rowIndex}
                  className="grid grid-cols-15 gap-1"
                  style={{ gridTemplateColumns: "repeat(15, 1fr)" }}
                >
                  {row.map((day, colIndex) => (
                    <motion.div
                      key={colIndex}
                      className="h-3 w-full rounded-sm"
                      style={{
                        backgroundColor: day
                          ? getColor(day.accomplishments)
                          : "#ebedf0",
                        border: "1px solid rgba(0,0,0,0.02)",
                      }}
                      whileHover={{
                        scale: 1.2,
                        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                        zIndex: 10,
                      }}
                      transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 15,
                      }}
                      title={
                        day
                          ? `${day.date}: ${
                              day.accomplishments > 0
                                ? `${day.accomplishments} accomplishment${
                                    day.accomplishments > 1 ? "s" : ""
                                  }`
                                : "No accomplishments"
                            }`
                          : ""
                      }
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end mt-4 items-center text-xs text-gray-500">
          <div className="mr-2">Fewer</div>
          {[0, 1, 2, 3, 4].map((accomplishments) => (
            <div
              key={accomplishments}
              className="h-3 w-3 rounded-sm mx-0.5"
              style={{
                backgroundColor: getColor(accomplishments),
                border: "1px solid rgba(0,0,0,0.02)",
              }}
            />
          ))}
          <div className="ml-2">More</div>
        </div>
        </div>
      </Card>
    </div>
  );
};

export default AccomplishmentGraph;
