import { useTheme } from 'next-themes';
import { Toaster as Sonner, toast } from 'sonner';

/*
 * Stock shadcn. The inherited version wrapped `toast` in a vocabulary mapper
 * that rewrote message strings at call time ("Contact created" -> "Noted.").
 * That belonged to the other product's tone charter. §2 sets a different rule
 * for Coram — name the thing plainly, at the call site — and a component that
 * silently rewrites the words a developer wrote is the wrong place to enforce
 * a copy style. Code review is.
 */

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = 'system' } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg',
          description: 'group-[.toast]:text-muted-foreground',
          actionButton: 'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton: 'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
