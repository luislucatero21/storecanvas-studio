import type { DeviceModel } from "./types";

export type IPhoneModelDefinition = {
  id: DeviceModel;
  label: string;
  detail: string;
  cutout: "dynamic-island" | "notch";
  chassis: [string, string, string];
  buttons: Array<{
    id: "action" | "mute" | "volume-up" | "volume-down" | "side" | "camera-control";
    side: "left" | "right";
    top: number;
    height: number;
  }>;
};

export const DEFAULT_IPHONE_MODEL: DeviceModel = "iphone-17-pro-max";

export const IPHONE_DEVICE_MODELS: IPhoneModelDefinition[] = [
  {
    id: "iphone-17-pro-max",
    label: "iPhone 17 Pro Max",
    detail: "Dynamic Island · Action · Camera Control",
    cutout: "dynamic-island",
    chassis: ["#60708A", "#24334A", "#AAB4C4"],
    buttons: [
      { id: "action", side: "left", top: 16, height: 5 },
      { id: "volume-up", side: "left", top: 25, height: 8 },
      { id: "volume-down", side: "left", top: 35, height: 8 },
      { id: "side", side: "right", top: 25, height: 14 },
      { id: "camera-control", side: "right", top: 64, height: 9 },
    ],
  },
  {
    id: "iphone-14-pro-max",
    label: "iPhone 14 Pro Max",
    detail: "Dynamic Island · Mute switch",
    cutout: "dynamic-island",
    chassis: ["#C8C4BC", "#6C6964", "#E8E4DB"],
    buttons: [
      { id: "mute", side: "left", top: 16, height: 4 },
      { id: "volume-up", side: "left", top: 25, height: 8 },
      { id: "volume-down", side: "left", top: 35, height: 8 },
      { id: "side", side: "right", top: 25, height: 14 },
    ],
  },
  {
    id: "iphone-13-pro-max",
    label: "iPhone 13 Pro Max",
    detail: "Classic notch · Mute switch",
    cutout: "notch",
    chassis: ["#44464B", "#17181B", "#90939A"],
    buttons: [
      { id: "mute", side: "left", top: 16, height: 4 },
      { id: "volume-up", side: "left", top: 25, height: 8 },
      { id: "volume-down", side: "left", top: 35, height: 8 },
      { id: "side", side: "right", top: 25, height: 14 },
    ],
  },
];

export function iphoneModelDefinition(model?: DeviceModel): IPhoneModelDefinition {
  return IPHONE_DEVICE_MODELS.find((candidate) => candidate.id === model)
    || IPHONE_DEVICE_MODELS[0];
}
