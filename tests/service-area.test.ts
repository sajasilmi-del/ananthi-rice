import { describe, expect, it } from "vitest";
import { DELIVERY_LOCATION_KEY } from "@/lib/delivery";
import {
  assessPincode,
  composeDeliveryAddress,
  pincodeStatusText,
  readConfirmedServiceArea,
  serviceAreas,
  validateDeliveryAddress,
  writeConfirmedServiceArea,
} from "@/lib/service-area";

describe("Chennai home delivery pincodes", () => {
  it("lists the eight delivery pincodes", () => {
    expect(serviceAreas.map((area) => area.pincode)).toEqual([
      "600032",
      "600078",
      "600083",
      "600087",
      "600089",
      "600095",
      "600116",
      "600125",
    ]);
    expect(serviceAreas.find((area) => area.pincode === "600089")?.areasEnglish).toBe("Ramapuram, Nandambakkam");
  });

  it("confirms a listed pincode and refuses anything else", () => {
    expect(assessPincode(" 600089 ").status).toBe("available");
    expect(assessPincode("600032")).toMatchObject({ areasEnglish: "Guindy, Ekkatuthangal" });
    expect(assessPincode("")).toEqual({ status: "required" });
    expect(assessPincode("60008")).toEqual({ status: "invalid" });
    expect(assessPincode("623707")).toEqual({ status: "unavailable", pincode: "623707" });
    expect(pincodeStatusText(assessPincode("623707"), "en")).toBe("Sorry, we can't deliver to this pincode right now.");
    expect(pincodeStatusText(assessPincode("600089"), "ta")).toContain("இராமபுரம்");
  });

  it("builds the address from the fields and ignores a stored map pin", () => {
    const input = {
      name: "Anand",
      door: "4/43 F",
      building: "Hillcrest",
      street: "Royala Nagar 2nd Main Road",
      locality: "Ramapuram",
      phone: "98765 43210",
      email: "Anand@Example.com",
      pincode: "600089",
    };
    expect(validateDeliveryAddress(input, "en")).toEqual({});
    expect(composeDeliveryAddress(input, "en")).toBe(
      "4/43 F, Hillcrest, Royala Nagar 2nd Main Road, Ramapuram, Chennai 600089, 9876543210",
    );
    expect(composeDeliveryAddress(input, "en")).not.toContain("@");
    expect(validateDeliveryAddress({ ...input, email: "not-an-email" }, "en").email).toBeTruthy();
    expect(composeDeliveryAddress(input, "ta")).toContain("சென்னை 600089");
    expect(Object.keys(validateDeliveryAddress({ ...input, name: "", phone: "123" }, "en"))).toEqual(
      expect.arrayContaining(["name", "mobile"]),
    );

    const storage = new Map<string, string>();
    const memory = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
    };
    memory.setItem(
      DELIVERY_LOCATION_KEY,
      JSON.stringify({ latitude: 13.02, longitude: 80.18, source: "map", addressLabel: "Pin", confirmedAt: "" }),
    );
    expect(readConfirmedServiceArea(memory)).toBeNull();
    writeConfirmedServiceArea(memory, {
      source: "pincode",
      pincode: "600125",
      areasEnglish: "Wrong",
      areasTamil: "Wrong",
      addressLabel: "Manapakkam, Chennai 600125",
      confirmedAt: "2026-10-06T00:00:00.000Z",
    });
    expect(readConfirmedServiceArea(memory)).toMatchObject({
      source: "pincode",
      pincode: "600125",
      areasEnglish: "Manapakkam",
      addressLabel: "Manapakkam, Chennai 600125",
    });
    writeConfirmedServiceArea(memory, {
      source: "pincode",
      pincode: "623707",
      areasEnglish: "Paramakudi",
      areasTamil: "பரமக்குடி",
      addressLabel: "Paramakudi",
      confirmedAt: "",
    });
    expect(readConfirmedServiceArea(memory)?.pincode).toBe("600125");
  });
});
