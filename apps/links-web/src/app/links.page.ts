import { ChangeDetectionStrategy, Component } from '@angular/core'
import { SOCIAL_LINKS, STORE_SCHEDULE } from './links-content'

@Component({
  selector: 'mo-links-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './links.page.html',
  styleUrl: './links.page.css',
})
export class LinksPage {
  readonly links = SOCIAL_LINKS
  readonly schedule = STORE_SCHEDULE
  readonly currentYear = new Date().getFullYear()
}
