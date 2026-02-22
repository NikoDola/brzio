# CLAUDE PROJECT RULES

You are working inside an existing Next.js 15 project using App Router.

Do not change the project structure.

Follow these rules strictly.

## ARCHITECTURE

Use App Router only.

Do not create src/pages.

All routes stay inside src/app.

src/app/page.tsx is the landing composition layer only.

Keep page.tsx clean. Only import sections.

Components structure:

### src/components/ui
Single UI elements only (Button, Input, Textarea).

### src/components/sections
- Hero
- HowToConnect
- HowItWorks
- ContactForm
- Navbar
- Footer

Each component must have its own CSS file next to it.

Use normal CSS only.
No Tailwind.
No UI libraries.
No unnecessary dependencies.

## STYLING RULES

Global variables inside:

src/app/globals.css

Define:

- primary-color
- primary-light-color
- primary-dark-color
- secondary-color
- secondary-light-color
- secondary-dark-color
- text-light-color
- text-color
- text-dark-color

Spacing variables:
- spacing-xs
- spacing-sm
- spacing-md
- spacing-lg
- spacing-xl

All margins and paddings must use spacing variables.

Mobile first design.

## MARKETING POSITIONING

We are not selling a gadget.
We are selling peace of mind and control.

Core emotional message:
Never panic again when you lose something important.

Target:
iPhone users 20 to 45.

Tone:
Clear. Direct. Trustworthy.

## HERO SECTION

3 slides.
Auto change every 5 seconds.
Navigation dots.
Smooth transition.

Desktop:
Images left.
Text right.

Mobile:
Text top.
Images bottom.

Each slide contains:

- Small pre-headline text (10 to 15 words)
- Headline (2 to 3 words only)
- Small supporting text (10 to 15 words)
- CTA button scrolling to contact form

Content:

**Slide 1**
Pre text: Престанете да ги барате клучевите и паричникот секој ден.
Headline: Секогаш Лоцирани
Supporting text: IOS Air Tags работат со Apple Find My и даваат точна локација.

**Slide 2**
Pre text: Поголема сигурност кога станува збор за вашето семејство.
Headline: Мир И Контрола
Supporting text: Лесно се ставаат во џеб, ранец или на клучеви.

**Slide 3**
Pre text: Дополнителна заштита за автомобил и вредни предмети.
Headline: Паметна Заштита
Supporting text: Добијте известување доколку предметот се помести.

CTA text:
Порачај веднаш

## OTHER SECTIONS

**HowToConnect:**
3 icons: iPhone, Bluetooth on, Location on.

**HowItWorks:**
Text explaining Apple network + 15m sound range.
CTA button to contact form.

**ContactForm:**
Required:
- Name
- Last Name
- Street Address
- Contact Number

Textarea optional.

Google reCAPTCHA with placeholder env keys.
EmailJS via Gmail.
Success message after submit.

## NAVBAR

Logo text:
brzio

Desktop horizontal.
Mobile burger with smooth animation.

## FOOTER

Instagram link.
Copyright text.

Technical support:
389-74-222-858

Orders:
389-78-808-596

Performance must be clean.
Reusable UI components.
Production ready.
