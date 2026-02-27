import { Response } from "express";
import { sharedVersion } from "@continuum/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HealthController } from "../src/health.controller";
import { ReadyController } from "../src/ready.controller";
import { ReadyService } from "../src/ready.service";

describe("HealthController", () => {
  it("returns health payload", () => {
    const controller = new HealthController();

    expect(controller.health()).toEqual({
      status: "ok",
      sharedVersion,
    });
  });
});

describe("ReadyController", () => {
  const readyService = {
    check: vi.fn(),
  } as unknown as ReadyService;

  const controller = new ReadyController(readyService);

  beforeEach(() => {
    readyService.check = vi.fn();
  });

  it("returns 200 payload when dependencies are healthy", async () => {
    readyService.check = vi.fn().mockResolvedValueOnce({
      ok: true,
      details: {
        postgres: "ok",
        redis: "ok",
      },
    });

    const res = { status: vi.fn() } as unknown as Response;
    const payload = await controller.ready(res);

    expect(payload).toEqual({
      status: "ok",
      details: {
        postgres: "ok",
        redis: "ok",
      },
    });
    expect(res.status).not.toHaveBeenCalled();
  });

  it("returns 503 payload when dependencies are unhealthy", async () => {
    readyService.check = vi.fn().mockResolvedValueOnce({
      ok: false,
      details: {
        postgres: "ok",
        redis: "redis timeout",
      },
    });

    const res = { status: vi.fn() } as unknown as Response;
    const payload = await controller.ready(res);

    expect(payload).toEqual({
      status: "error",
      details: {
        postgres: "ok",
        redis: "redis timeout",
      },
    });
    expect(res.status).toHaveBeenCalledWith(503);
  });
});
