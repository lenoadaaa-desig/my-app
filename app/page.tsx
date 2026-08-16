"use client";

import Link from "next/link";
import { Disclosure, DisclosureButton, DisclosurePanel } from "@headlessui/react";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const faqs = [
  {
    question: "TableNow คืออะไร",
    answer:
      "TableNow เป็นแพลตฟอร์มจองโต๊ะร้านอาหารออนไลน์ ให้คุณค้นหาร้าน เลือกเวลา และจองโต๊ะได้ทันทีโดยไม่ต้องโทรศัพท์ไปที่ร้าน",
  },
  {
    question: "การจองผ่าน TableNow มีค่าใช้จ่ายไหม",
    answer:
      "การจองโต๊ะผ่าน TableNow ไม่มีค่าธรรมเนียมสำหรับผู้ใช้งาน ยกเว้นบางร้านที่กำหนดให้มีการมัดจำล่วงหน้า ซึ่งจะแจ้งยอดให้เห็นชัดเจนก่อนยืนยันการจองทุกครั้ง",
  },
  {
    question: "จองโต๊ะล่วงหน้าได้กี่วัน",
    answer:
      "แต่ละร้านเปิดให้จองล่วงหน้าไม่เท่ากัน โดยทั่วไปสามารถจองล่วงหน้าได้ตั้งแต่ 1 วัน ไปจนถึง 30 วัน ระบบจะแสดงช่วงเวลาที่จองได้ของร้านนั้นๆ ให้อัตโนมัติ",
  },
  {
    question: "ต้องมัดจำหรือชำระเงินล่วงหน้าไหม",
    answer:
      "ขึ้นอยู่กับนโยบายของแต่ละร้าน บางร้านอาจขอมัดจำสำหรับการจองกลุ่มใหญ่หรือช่วงเวลาที่มีคนจองเยอะ หากร้านกำหนดให้มัดจำ ระบบจะแจ้งจำนวนเงินและเงื่อนไขให้ทราบก่อนยืนยันการจอง",
  },
  {
    question: "ยกเลิกหรือแก้ไขการจองได้ไหม",
    answer:
      "ได้ คุณสามารถยกเลิกหรือแก้ไขวันเวลา/จำนวนที่นั่งได้จากหน้ารายการจองของคุณ โดยแนะนำให้ทำล่วงหน้าอย่างน้อย 2 ชั่วโมงก่อนเวลาจอง เพื่อให้ร้านจัดสรรโต๊ะให้ลูกค้าท่านอื่นได้ทัน",
  },
  {
    question: "ถ้าไปสายหรือไม่ไปตามที่จองไว้จะเป็นอะไรไหม",
    answer:
      "หากไปสายเกินเวลาที่ร้านกำหนด (โดยทั่วไปประมาณ 15 นาที) ร้านอาจยกเลิกการจองและปล่อยโต๊ะให้ลูกค้าท่านอื่น หากไม่มาโดยไม่แจ้งยกเลิกบ่อยครั้ง บัญชีของคุณอาจถูกจำกัดการจองชั่วคราว",
  },
  {
    question: "จองสำหรับกลุ่มใหญ่หรือจัดงานพิเศษได้ไหม",
    answer:
      "ได้ หลายร้านรองรับการจองกลุ่มใหญ่ เพียงเลือกจำนวนที่นั่งตามจริงตอนจอง หากเป็นงานพิเศษหรือกลุ่มที่มีจำนวนมากเกินกว่าระบบกำหนด แนะนำให้ติดต่อร้านโดยตรงผ่านข้อมูลติดต่อในหน้าร้าน",
  },
  {
    question: "ต้องสมัครสมาชิกก่อนถึงจะจองได้ไหม",
    answer:
      "ต้องสมัครสมาชิกและเข้าสู่ระบบก่อนจึงจะจองโต๊ะได้ เพื่อให้คุณติดตามสถานะการจอง แก้ไข หรือยกเลิกการจองย้อนหลังได้ในภายหลัง",
  },
  {
    question: "ร้านอาหารที่ต้องการเข้าร่วมกับ TableNow ทำอย่างไร",
    answer:
      "เจ้าของร้านที่สนใจเข้าร่วมสามารถติดต่อทีมงานผ่านช่องทางติดต่อด้านล่าง เพื่อขอเปิดบัญชีร้านค้าและตั้งค่าโต๊ะ ช่วงเวลาเปิดจอง รวมถึงเงื่อนไขต่างๆ ของร้าน",
  },
  {
    question: "หากมีปัญหาการจองจะติดต่อได้ทางไหน",
    answer:
      "สามารถติดต่อทีมสนับสนุนของ TableNow ได้ผ่านหน้าติดต่อเรา หรืออีเมลที่แสดงในระบบ ทีมงานพร้อมช่วยเหลือเรื่องการจอง การยกเลิก และปัญหาการใช้งานอื่นๆ",
  },
];

export default function Page() {
  return (
    <div className="bg-canvas">
      <div className="relative isolate px-6 pt-14 lg:px-8">
        <div
          aria-hidden="true"
          className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80"
        >
          <div
            style={{
              clipPath:
                "polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)",
            }}
            className="relative left-[calc(50%-11rem)] aspect-1155/678 w-144.5 -translate-x-1/2 rotate-30 bg-linear-to-tr from-sun to-tangerine opacity-40 sm:left-[calc(50%-30rem)] sm:w-288.75"
          />
        </div>
        <div className="mx-auto max-w-2xl py-32 sm:py-48 lg:py-40">
          <div className="text-center">
            <h1 className="font-heading text-5xl font-semibold tracking-tight text-balance text-ink sm:text-7xl">
              TableNow
            </h1>
            <p className="mt-8 text-lg font-medium text-pretty text-ink-soft sm:text-xl/8">
              แพลตฟอร์มจองโต๊ะร้านอาหารออนไลน์ ค้นหาร้าน เลือกเวลา และจองโต๊ะได้ในไม่กี่คลิก
              ไม่ต้องโทรศัพท์ ไม่ต้องรอสาย
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <Link href="/signup" className={cn(buttonVariants({ size: "lg" }))}>
                เริ่มจองโต๊ะ
              </Link>
              <a href="#faq" className="text-sm/6 font-semibold text-ink">
                คำถามที่พบบ่อย <span aria-hidden="true">→</span>
              </a>
            </div>
          </div>
        </div>
      </div>

      <div id="faq" className="mx-auto max-w-4xl px-6 pb-24 sm:pb-32 lg:px-8">
        <h2 className="font-heading text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          คำถามที่พบบ่อย
        </h2>
        <dl className="mt-10 divide-y divide-gold-dim">
          {faqs.map((faq) => (
            <Disclosure key={faq.question} as="div" className="py-6 first:pt-0 last:pb-0">
              {({ open }) => (
                <>
                  <dt>
                    <DisclosureButton className="flex w-full items-start justify-between text-left text-ink">
                      <span className="text-base/7 font-semibold">{faq.question}</span>
                      <span className="ml-6 flex h-7 items-center">
                        <ChevronDownIcon
                          aria-hidden="true"
                          className={`size-6 text-ink-mute transition-transform ${open ? "rotate-180" : ""}`}
                        />
                      </span>
                    </DisclosureButton>
                  </dt>
                  <DisclosurePanel as="dd" className="mt-2 pr-12">
                    <p className="text-base/7 text-ink-soft">{faq.answer}</p>
                  </DisclosurePanel>
                </>
              )}
            </Disclosure>
          ))}
        </dl>
      </div>

      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-[calc(100%-13rem)] -z-10 transform-gpu overflow-hidden blur-3xl sm:top-[calc(100%-30rem)]"
      >
        <div
          style={{
            clipPath:
              "polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)",
          }}
          className="relative left-[calc(50%+3rem)] aspect-1155/678 w-144.5 -translate-x-1/2 bg-linear-to-tr from-gold-dim to-sky opacity-40 sm:left-[calc(50%+36rem)] sm:w-288.75"
        />
      </div>
    </div>
  );
}
