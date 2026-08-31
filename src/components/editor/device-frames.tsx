"use client";
import * as React from "react";
import { PHONE_SCREEN } from "@/lib/constants";
import { iphoneModelDefinition } from "@/lib/device-models";
import { img } from "@/lib/image-cache";
import type { DeviceModel, DevicePresentation } from "@/lib/types";

type FrameProps = {
  src: string;
  alt?: string;
  style?: React.CSSProperties;
  model?: DeviceModel;
  presentation?: DevicePresentation;
  /** When true, hide EmptySlot placeholder (so it doesn't bake into exports). */
  hideEmpty?: boolean;
};

// iPhone hardware is rendered as a layered vector frame so its cutout,
// controls and side rail remain legible under the shared 3D camera rig.
export function Phone({ src, alt = "", style, hideEmpty, model, presentation }: FrameProps) {
  const resolved = img(src);
  const hardware = iphoneModelDefinition(model);
  const tilt = presentation?.rotateY || 0;
  const depth = Math.max(2, presentation?.depth || 2);
  const visibleSide = tilt < 0 ? "right" : tilt > 0 ? "left" : null;
  return (
    <div
      data-device-model={hardware.id}
      data-device-cutout={hardware.cutout}
      style={{
        position: "relative",
        aspectRatio: "1022 / 2082",
        transformStyle: "preserve-3d",
        isolation: "isolate",
        ...style,
      }}
    >
      <div
        aria-hidden
        data-hardware-feature="side-rail"
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "10.8% / 5.3%",
          background: `linear-gradient(90deg, ${hardware.chassis[1]}, ${hardware.chassis[0]} 48%, ${hardware.chassis[2]})`,
          transform: `translateZ(-${depth}px)`,
          boxShadow: visibleSide === "left"
            ? `-${Math.max(2, depth * 0.35)}px 0 ${Math.max(3, depth * 0.6)}px rgba(10,12,16,.42)`
            : visibleSide === "right"
              ? `${Math.max(2, depth * 0.35)}px 0 ${Math.max(3, depth * 0.6)}px rgba(10,12,16,.42)`
              : "0 1px 3px rgba(10,12,16,.24)",
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 2,
          borderRadius: "10.8% / 5.3%",
          background: `linear-gradient(115deg, ${hardware.chassis[2]} 0%, ${hardware.chassis[0]} 22%, ${hardware.chassis[1]} 64%, ${hardware.chassis[2]} 100%)`,
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,.34), inset 0 0 0 3px rgba(10,12,16,.42)",
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: "1.15%",
          zIndex: 3,
          borderRadius: "10.2% / 5%",
          background: "#050608",
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,.08)",
        }}
      />
      <div
        style={{
          position: "absolute",
          zIndex: 10,
          overflow: "hidden",
          left: `${PHONE_SCREEN.L}%`,
          top: `${PHONE_SCREEN.T}%`,
          width: `${PHONE_SCREEN.W}%`,
          height: `${PHONE_SCREEN.H}%`,
          borderRadius: `${PHONE_SCREEN.RX}% / ${PHONE_SCREEN.RY}%`,
          background: "#111",
        }}
      >
        {resolved ? (
          <img
            src={resolved}
            alt={alt}
            style={{ display: "block", width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }}
            draggable={false}
          />
        ) : hideEmpty ? null : (
          <EmptySlot />
        )}
      </div>
      {hardware.cutout === "dynamic-island" ? (
        <div
          aria-hidden
          data-hardware-feature="dynamic-island"
          style={{
            position: "absolute",
            zIndex: 30,
            top: "3.15%",
            left: "50%",
            width: "25%",
            height: "2.55%",
            transform: "translateX(-50%) translateZ(2px)",
            borderRadius: "999px",
            background: "#020203",
            boxShadow: "inset 0 0 0 1px rgba(255,255,255,.025), 0 1px 2px rgba(0,0,0,.5)",
          }}
        >
          <span
            style={{
              position: "absolute",
              right: "8%",
              top: "24%",
              width: "10%",
              aspectRatio: "1",
              borderRadius: "50%",
              background: "radial-gradient(circle at 40% 35%, #264d73 0 10%, #07121e 28%, #010205 70%)",
            }}
          />
        </div>
      ) : (
        <div
          aria-hidden
          data-hardware-feature="notch"
          style={{
            position: "absolute",
            zIndex: 30,
            top: "2.15%",
            left: "50%",
            width: "43%",
            height: "4.2%",
            transform: "translateX(-50%) translateZ(2px)",
            borderRadius: "0 0 22% 22% / 0 0 55% 55%",
            background: "#020203",
          }}
        />
      )}
      {hardware.buttons.map((button) => {
        const visible = !visibleSide || visibleSide === button.side;
        return (
          <div
            key={button.id}
            aria-hidden
            data-hardware-button={button.id}
            style={{
              position: "absolute",
              zIndex: visible ? 22 : 1,
              [button.side]: "-0.62%",
              top: `${button.top}%`,
              width: "1.18%",
              height: `${button.height}%`,
              borderRadius: "999px",
              opacity: visible ? 1 : 0.58,
              background: `linear-gradient(90deg, ${hardware.chassis[1]}, ${hardware.chassis[2]}, ${hardware.chassis[0]})`,
              boxShadow: visible ? "0 0 0 1px rgba(8,10,14,.3), 0 1px 2px rgba(8,10,14,.35)" : undefined,
              transform: `translateZ(${-depth * 0.35}px)`,
            }}
          />
        );
      })}
    </div>
  );
}

export function AndroidPhone({ src, alt = "", style, hideEmpty }: FrameProps) {
  const resolved = img(src);
  return (
    <div style={{ position: "relative", aspectRatio: "9 / 19.5", ...style }}>
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: "8% / 4%",
          background: "linear-gradient(160deg, #2a2a2e 0%, #18181b 100%)",
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08), 0 8px 40px rgba(0,0,0,0.55)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "1.5%",
            left: "50%",
            transform: "translateX(-50%)",
            width: "3%",
            height: "1.4%",
            borderRadius: "50%",
            background: "#0d0d0f",
            border: "1px solid rgba(255,255,255,0.06)",
            zIndex: 20,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: "3.5%",
            top: "2%",
            width: "93%",
            height: "96%",
            borderRadius: "5.5% / 2.6%",
            overflow: "hidden",
            background: "#000",
          }}
        >
          {resolved ? (
            <img
              src={resolved}
              alt={alt}
              style={{ display: "block", width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }}
              draggable={false}
            />
          ) : hideEmpty ? null : (
            <EmptySlot />
          )}
        </div>
      </div>
    </div>
  );
}

export function AndroidTabletP({ src, alt = "", style, hideEmpty }: FrameProps) {
  const resolved = img(src);
  return (
    <div style={{ position: "relative", aspectRatio: "5 / 8", ...style }}>
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: "4.5% / 2.8%",
          background: "linear-gradient(160deg, #2a2a2e 0%, #18181b 100%)",
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08), 0 8px 48px rgba(0,0,0,0.6)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "1.2%",
            left: "50%",
            transform: "translateX(-50%)",
            width: "1.4%",
            height: "0.88%",
            borderRadius: "50%",
            background: "#0d0d0f",
            zIndex: 20,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: "3.5%",
            top: "2.2%",
            width: "93%",
            height: "95.6%",
            borderRadius: "2.5% / 1.6%",
            overflow: "hidden",
            background: "#000",
          }}
        >
          {resolved ? (
            <img
              src={resolved}
              alt={alt}
              style={{ display: "block", width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }}
              draggable={false}
            />
          ) : hideEmpty ? null : (
            <EmptySlot />
          )}
        </div>
      </div>
    </div>
  );
}

export function AndroidTabletL({ src, alt = "", style, hideEmpty }: FrameProps) {
  const resolved = img(src);
  return (
    <div style={{ position: "relative", aspectRatio: "8 / 5", ...style }}>
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: "2.8% / 4.5%",
          background: "linear-gradient(160deg, #2a2a2e 0%, #18181b 100%)",
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08), 0 8px 48px rgba(0,0,0,0.6)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: "1.2%",
            top: "50%",
            transform: "translateY(-50%)",
            width: "0.88%",
            height: "1.4%",
            borderRadius: "50%",
            background: "#0d0d0f",
            zIndex: 20,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: "2.2%",
            top: "3.5%",
            width: "95.6%",
            height: "93%",
            borderRadius: "1.6% / 2.5%",
            overflow: "hidden",
            background: "#000",
          }}
        >
          {resolved ? (
            <img
              src={resolved}
              alt={alt}
              style={{ display: "block", width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }}
              draggable={false}
            />
          ) : hideEmpty ? null : (
            <EmptySlot />
          )}
        </div>
      </div>
    </div>
  );
}

export function IPad({ src, alt = "", style, hideEmpty }: FrameProps) {
  const resolved = img(src);
  return (
    <div style={{ position: "relative", aspectRatio: "770 / 1000", ...style }}>
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: "5% / 3.6%",
          background: "linear-gradient(180deg, #2C2C2E 0%, #1C1C1E 100%)",
          position: "relative",
          overflow: "hidden",
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.1), 0 8px 40px rgba(0,0,0,0.6)",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "1.2%",
            left: "50%",
            transform: "translateX(-50%)",
            width: "0.9%",
            height: "0.65%",
            borderRadius: "50%",
            background: "#111113",
            zIndex: 20,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: "4%",
            top: "2.8%",
            width: "92%",
            height: "94.4%",
            borderRadius: "2.2% / 1.6%",
            overflow: "hidden",
            background: "#000",
          }}
        >
          {resolved ? (
            <img
              src={resolved}
              alt={alt}
              style={{ display: "block", width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }}
              draggable={false}
            />
          ) : hideEmpty ? null : (
            <EmptySlot />
          )}
        </div>
      </div>
    </div>
  );
}

function EmptySlot() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "rgba(255,255,255,0.4)",
        fontSize: "min(2vw, 14px)",
        background: "linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%)",
        textAlign: "center",
        padding: "4%",
      }}
    >
      Drop a screenshot here
    </div>
  );
}
