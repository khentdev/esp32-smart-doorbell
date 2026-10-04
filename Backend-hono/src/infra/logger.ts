import { configure, getConsoleSink } from "@logtape/logtape";
import { prettyFormatter } from "@logtape/pretty";

await configure({
  sinks: { console: getConsoleSink({ formatter: prettyFormatter }) },
  loggers: [
    { category: "my-app", lowestLevel: "debug", sinks: ["console"] },
    {
      category: ["logtape", "meta"],
      lowestLevel: "warning",
      sinks: ["console"],
    },
  ],
});