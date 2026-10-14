import type { ReactNode } from "react";

import { Container, SectionHeading, textLinkStyles } from "@/components/marketing/primitives";
import { pageMetadata } from "@/components/marketing/seo";
import { site } from "@/content/site";

/*
 * TODO(legal): review under India's DPDP Act (Digital Personal Data Protection
 * Act, 2023) and the DPDP Rules before launch. This is a DRAFT written for the
 * website enquiry form. Points to confirm:
 *   - legal entity name and registered address of the Data Fiduciary
 *   - named contact / grievance officer and response timelines
 *   - retention period for enquiries that do not become projects
 *   - list of processors (hosting, database, email/SMS) and where data is stored
 *   - wording of the consent checkbox on the enquiry form
 * Nothing below is shown to visitors as "draft"; update LAST_UPDATED when it changes.
 */
const LAST_UPDATED = "14 October 2026";

export const metadata = pageMetadata({
  title: "Privacy notice",
  description: `How ${site.name} collects, uses and protects the details you share through our website enquiry form.`,
  path: "/privacy",
});

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-ink/10 pt-8">
      <h2 className="font-heading text-2xl font-light tracking-[-0.01em] text-ink">{title}</h2>
      <div className="mt-4 space-y-4 leading-relaxed text-ink/80 [&_li]:pl-1 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
        {children}
      </div>
    </section>
  );
}

export default function PrivacyPage() {
  const email = (
    <a href={`mailto:${site.email}`} className={textLinkStyles}>
      {site.email}
    </a>
  );

  return (
    <Container className="pt-16 pb-24 sm:pt-20">
      <div className="mx-auto max-w-3xl">
        <SectionHeading
          as="h1"
          eyebrow="Privacy"
          title="Privacy notice"
          intro={`This notice explains what ${site.name} does with the details you share when you send us an enquiry through this website.`}
        />
        <p className="mt-6 text-sm text-ink/70">Last updated {LAST_UPDATED}</p>

        <div className="mt-12 space-y-10">
          <Block title="Who we are">
            <p>
              {site.name} (&ldquo;we&rdquo;, &ldquo;us&rdquo;) is an interior design and construction studio. We decide
              how the details you give us are used. You can contact us about privacy at any time at {email}.
            </p>
            {site.address ? (
              <p>
                Our studio is at {site.address.streetAddress}, {site.address.locality}, {site.address.region}{" "}
                {site.address.postalCode}.
              </p>
            ) : null}
          </Block>

          <Block title="What we collect">
            <p>When you send an enquiry, we collect:</p>
            <ul>
              <li>your name and mobile number;</li>
              <li>
                if you choose to share them: your email address, area and city, project type, budget range and your
                message.
              </li>
            </ul>
            <p>
              Our servers also process your IP address when you submit the form, to protect it from abuse such as
              repeated automated submissions.
            </p>
          </Block>

          <Block title="Why we use it">
            <ul>
              <li>to call you back and answer your enquiry;</li>
              <li>to arrange a site visit, and prepare a design and quotation if you ask us to;</li>
              <li>to keep a record of our conversation so anyone on our team can pick it up.</li>
            </ul>
            <p>
              We use your details only for these purposes. We do not sell them, and we do not use them for unrelated
              marketing.
            </p>
          </Block>

          <Block title="Your consent">
            <p>
              We process your details because you agree to it when you tick the consent box on the enquiry form. You
              can withdraw your consent at any time by emailing {email}. Withdrawing consent does not affect anything
              we did with your details before you withdrew it.
            </p>
          </Block>

          <Block title="Who can see your details">
            <ul>
              <li>members of our team who handle enquiries and projects;</li>
              <li>
                service providers who host and run our systems for us, such as cloud hosting and database providers,
                who may use your details only on our instructions.
              </li>
            </ul>
            <p>We share your details with anyone else only when the law requires us to.</p>
          </Block>

          <Block title="How long we keep them">
            <p>
              If you go ahead with a project, we keep your details for as long as the project runs and afterwards for
              as long as the law requires us to keep business records. If you don&apos;t go ahead, we keep your enquiry
              only as long as we need it to follow up, and then delete it.
            </p>
          </Block>

          <Block title="Your rights">
            <p>You can ask us to:</p>
            <ul>
              <li>tell you what details we hold about you and how we use them;</li>
              <li>correct or update your details;</li>
              <li>delete your details, unless the law requires us to keep them;</li>
              <li>nominate someone to exercise these rights for you if you are unable to.</li>
            </ul>
            <p>
              Email {email} and we will respond as soon as we can. If you are not satisfied with our response, you may
              raise a complaint with the Data Protection Board of India.
            </p>
          </Block>

          <Block title="Keeping your details safe">
            <p>
              Your details are sent over an encrypted connection and stored in access-controlled systems. Only people
              who need them for your enquiry or project can see them.
            </p>
          </Block>

          <Block title="Cookies">
            <p>
              The public pages of this website do not use advertising or tracking cookies. If you sign in to the{" "}
              {site.name} client portal, we use essential cookies to keep you signed in securely.
            </p>
          </Block>

          <Block title="Children">
            <p>Our website and services are meant for adults. Please do not send us an enquiry if you are under 18.</p>
          </Block>

          <Block title="Changes to this notice">
            <p>
              If we change how we use your details, we will update this page and the date at the top. Please check it
              from time to time.
            </p>
          </Block>
        </div>
      </div>
    </Container>
  );
}
